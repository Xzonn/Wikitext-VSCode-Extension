/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Rowe Wilson Frederisk Holme. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Part of the content comes from https://github.com/jasonwilliams/mediawiki-support/blob/master/src/webCitation.ts under license Apache-2.0

import * as vscode from "vscode";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import type { Response } from "node-fetch";
import { DateTime } from "luxon";
import { ArchiveConvert, ArchiveResult } from "../../interface_definition/archiveInterface";
import { TextDecoder } from "util";
import { i18n, lang } from "../i18n_function/i18n";

export async function addWebCite(): Promise<void> {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wikitext");

    const url: string | undefined = await vscode.window.showInputBox({
        prompt: i18n("enter-url-to-ref", lang),
        placeHolder: "https://sample.com",
        ignoreFocusOut: true
    });
    if (!url) { return undefined; }

    const barMessage: vscode.Disposable = vscode.window.setStatusBarMessage("Wikitext: Parsing...");
    try {
        const citeInfo: WebCiteInfo = new WebCiteInfo(url);
        await citeInfo.buildInfo();
        const result: string = citeInfo.toString(config.get("webCiteFormat") ?? "");

        const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
        const selection: vscode.Selection | undefined = editor?.selection;

        if (selection) {
            editor?.edit((editorBuilder) => {
                editorBuilder.insert(selection.active, result);
            });
        }
    }
    catch (error: any) {
        vscode.window.showErrorMessage(i18n("error", lang, error.info || error.message));
    }
    finally {
        barMessage.dispose();
    }
}

class WebCiteInfo {

    config: vscode.WorkspaceConfiguration;
    url: string;
    author?: string;
    title?: string;
    accessDate: string;
    siteName?: string;
    publishDate?: string;
    archivedUrl?: string;
    archivedDate?: string;
    language?: string;
    private archiveApiUrl: string;
    private metaData!: cheerio.Root;

    constructor(url: string) {
        this.config = vscode.workspace.getConfiguration("wikitext");
        this.url = url;
        this.accessDate = DateTime.now().toISODate();
        this.archiveApiUrl = `https://archive.org/wayback/available?url=${url}`;
    }

    public toString(format: string): string {
        format = getReplacedString(format, "url", this.url);
        format = getReplacedString(format, "author", this.author);
        format = getReplacedString(format, "title", this.title, this.language);
        format = getReplacedString(format, "accessdate", this.accessDate);
        format = getReplacedString(format, "website", this.siteName);
        format = getReplacedString(format, "publicationdate", this.publishDate);
        format = getReplacedString(format, "archiveurl", this.archivedUrl);
        format = getReplacedString(format, "archivedate", this.archivedDate);
        format = getReplacedString(format, "language", this.language);
        return format;
    }

    public async buildInfo(): Promise<void> {
        await this.fetchArchive();
        this.setTitle();
        this.setPublishedDate();
        this.setSiteName();
        this.setAuthor();
        this.setLanguage();
    }

    private async fetchArchive(): Promise<void> {
        const websiteResponse = await fetch(this.url, {
            "headers": {
                // Fake User-Agent
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.0.0 Safari/537.36"
            }
        });
        const websiteText: string = await websiteResponse.text();
        this.metaData = cheerio.load(websiteText);

        const websiteEncoding =
            this.getAttr("meta[charset]", "charset") ||
            ((this.getAttr("meta[http-equiv='content-type']") || websiteResponse.headers.get("content-type") || "").match(/(?<=^|;\s*)charset=(\S+)(?=$|;)/) || [])[1];
        if ((websiteEncoding || "utf-8").toLowerCase() !== "utf-8") {
            const reloadResponse = await fetch(this.url);
            const reloadBuffer = await reloadResponse.arrayBuffer();
            const decoder = new TextDecoder(websiteEncoding);
            const reloadText = decoder.decode(reloadBuffer);
            this.metaData = cheerio.load(reloadText);
        }

        if (this.config.get("webCiteArchive")) {
            try {
                const archiveResponse = await fetch(this.archiveApiUrl);
                const archiveJSON: ArchiveResult = await archiveResponse.json();
                const re = ArchiveConvert.toArchiveResult(archiveJSON);

                // Check archive and get the closest
                if (re.archivedSnapshots.closest) {
                    this.archivedUrl = re.archivedSnapshots.closest.url;
                    if (this.archivedUrl.indexOf("https") > -1) {
                        // Force link to "https://"
                        this.archivedUrl = this.archivedUrl.replace(/^http:\/\//, "https://");
                    }
                    this.archivedDate = DateTime.fromFormat(re.archivedSnapshots.closest.timestamp, "yyyyMMddhhmmss").toISODate();
                }
            }
            catch (error: any) {
                vscode.window.showErrorMessage(i18n("error", lang, error.info || error.message));
            }
        }
    }

    private setAuthor(): void {
        this.author =
            this.getTextFromSelector("webCiteAuthorSelector") ||
            this.getText(".author-name") ||
            this.getText(".author");
    }

    private setTitle(): void {
        const title =
            this.getTextFromSelector("webCiteTitleSelector") ||
            this.getAttr("meta[property='og:og:title']") ||
            this.getAttr("meta[property='twitter:title']") ||
            this.getText("h1");
        // Some websites use | or - as a separator
        const indirectTitle =
            this.getText("title");
        this.title = title || (indirectTitle || "").split("|")[0].split(" - ")[0];
    }

    private setPublishedDate(): void {
        const date =
            this.getTextFromSelector("webCiteDateSelector") ||
            this.getAttr("meta[property='article:published_time']") ||
            this.getAttr("time", "datetime");
        if (date) {
            try {
                this.publishDate = DateTime.fromISO(date).toISODate();
            }
            catch (error: any) {
                try{
                    this.publishDate = DateTime.fromJSDate(new Date(date)).toISODate();
                }
                catch (error: any) {
                    vscode.window.showErrorMessage(i18n("error", lang, error.info || error.message));
                    this.publishDate = date;
                }
            }
        }
    }

    private setSiteName(): void {
        this.siteName =
            this.getAttr("meta[property='og:site_name']") ||
            this.getAttr("meta[property='twitter:site']");
        if (!this.siteName) {
            // Some websites use | or - as a separator
            const title = this.getText("title");
            if (title) {
                if (title.indexOf("|") > -1) {
                    this.siteName = title.split("|").reverse()[0];
                } else if (title.indexOf(" - ") > -1) {
                    this.siteName = title.split(" - ").reverse()[0];
                }
            }
        }
    }

    private setLanguage(): void {
        this.language =
            this.getAttr("html", "lang") ||
            this.getAttr("body", "lang") ||
            this.getAttr("article", "lang");
    }

    private getAttr(ioName: string, attrName = 'content'): string | undefined {
        const io: cheerio.Cheerio = this.metaData(ioName);
        if (io.length) {
            return io.attr(attrName) || undefined;
        }
    }

    private getText(ioName: string): string | undefined {
        const io: cheerio.Cheerio = this.metaData(ioName);
        if (io.length) {
            return io.text().split(/\s+/).join(" ") || undefined;
        }
    }

    private getTextFromSelector(configName: string): string | undefined {
        const selectors = (<string>this.config.get(configName)).split(",");
        let text: string | undefined = "";
        let selector: string | undefined = "";
        while ((selector = selectors.shift()) && !text) {
            const selectorType = (<string>selector).split("|");
            if (selectorType[1]) {
                text = this.getAttr(selectorType[0], selectorType[1]);
            } else {
                text = this.getText(selectorType[0]);
            }
        }
        return text;
    }
}

/**
* Replace all argument.
*/
export function getReplacedString(formatStr: string, argStr: string, replaceStr: string | undefined, language: string | undefined = undefined): string {
    // /\{$arg\}/
    const argRegExp = new RegExp(`\\{\\$${argStr}\\}`, 'g');
    replaceStr = replaceStr?.trim().split("|").join("&#124;");
    if (replaceStr) {
        // remove all <!arg> and </!arg>
        // /\<\/?\!arg\>/
        formatStr = formatStr.replace(new RegExp(`<\\/?!${argStr}>`, 'g'), '');
        if (argStr === "title" && language === "ja") {
            formatStr = formatStr.replace(new RegExp("(?<=\|\\s*)title(?=\\s*=)", "g"), "script-title");
            formatStr = formatStr.replace(argRegExp, `${language}:${replaceStr}`);
        } else {
            // replace all {$arg}
            formatStr = formatStr.replace(argRegExp, replaceStr);
        }
    } else {
        // remove all substring between <!arg> and </!arg>
        // /\<\!arg\>[\s\S]*?\<\/\!arg\>/
        formatStr = formatStr.replace(new RegExp(`<!${argStr}>[\\s\\S]*?<\\/!${argStr}>`, 'g'), '');
        // clear all argument
        formatStr = formatStr.replace(argRegExp, '');
    }
    return formatStr;
}