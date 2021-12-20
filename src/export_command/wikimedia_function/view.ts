/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Rowe Wilson Frederisk Holme. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type MWBot from 'mwbot';
import { extensionContext } from '../../extension';
import { Action, ContextModel, alterNativeValues, Prop } from './args';
import { GetViewResult, ViewConverter } from '../../interface_definition/getViewInterface';
import { getHost } from '../host_function/host';
import { getDefaultBot } from './bot';
import { getContentInfo } from './page';
import { lang, i18n } from '../i18n_function/i18n';
import { ReadPageConvert, ReadPageResult } from '../../interface_definition/readPageInterface';
import { showMWErrorMessage } from './err_msg';

/**
 * webview panel
 */
let previewCurrentPanel: vscode.WebviewPanel | undefined;

export async function getPreview(): Promise<void> {
    return getPreviewHelper(false);
}

export async function getDiff(): Promise<void> {
    return getPreviewHelper(true);
}

export async function getPreviewHelper(isDiff = false) {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wikitext");

    const host: string | undefined = await getHost();
    if (!host) { return undefined; }

    /** document text */
    const document = vscode.window.activeTextEditor?.document;
    let sourceText: string | undefined = document?.getText();
    if (!sourceText) { return undefined; }

    // info
    const info = getContentInfo(sourceText);
    const title = info.info?.pageTitle ?? (document?.isUntitled ? undefined : document?.fileName.split(/[\/\\]/).reverse()[0].split(".")[0]);

    // remove
    sourceText = sourceText?.replace(/\<%\-\-\s*\[PAGE_INFO\][\s\S]*?\[END_PAGE_INFO\]\s*\-\-%\>\s*/, "");

    /** arguments */
    const args = {
        'uselang': vscode.env.language
    };
    if (isDiff) {
        Object.assign(args, {
            'action': Action.query,
            'prop': Prop.reVisions,
            'rvdifftotext': sourceText,
            'rvdifftotextpst': "1",
            'rvprop': "",
            'titles': title
        });
    } else {
        Object.assign(args, {
            'action': Action.parse,
            'text': sourceText,
            'prop': alterNativeValues(
                Prop.text,
                Prop.displayTitle,
                Prop.categoriesHTML,
                (config.get("getCss") ? Prop.headHTML : undefined)
            ),
            'contentmodel': info.info?.contentModel ?? ContextModel.wikitext,
            'pst': "why_not",
            'disableeditsection': "yes",
            'title': title
        });
    }

    const viewerTitle = "WikitextPreviewer";

    // if no panel, creat one
    if (!previewCurrentPanel) {
        // if have not, try to creat new one.
        previewCurrentPanel = vscode.window.createWebviewPanel(
            "previewer", viewerTitle, vscode.ViewColumn.Beside, {
            enableScripts: config.get("enableJavascript"),
        });
        // register for events that release resources.
        previewCurrentPanel.onDidDispose(() => {
            previewCurrentPanel = undefined;
        }, null, extensionContext.subscriptions);
    }

    const tBot: MWBot | undefined = await getDefaultBot();
    if (!tBot) {
        return undefined;
    }

    const baseHref: string = config.get("transferProtocol") + host + config.get("articlePath");

    if (isDiff) {
        getDiffParse(previewCurrentPanel, viewerTitle, args, tBot, baseHref);
    } else {
        getViewParse(previewCurrentPanel, viewerTitle, args, tBot, baseHref);
    }
}

export async function getPageView(): Promise<void> {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wikitext");

    const host: string | undefined = await getHost();
    if (!host) { return undefined; }

    const pageTitle: string | undefined = await vscode.window.showInputBox({
        prompt: i18n("enter-page-name", lang),
        ignoreFocusOut: true
    });
    if (!pageTitle) { return undefined; }

    const args: Record<string, string> = {
        action: Action.parse,
        page: pageTitle,
        prop: alterNativeValues(
            Prop.text,
            Prop.displayTitle,
            Prop.categoriesHTML,
            (config.get("getCss") ? Prop.headHTML : undefined)
        ),
        uselang: lang
    };
    args['redirects'] = config.get("redirects") ? "1" : "0";
    args['converttitles'] = config.get("converttitles") ? "1" : "0";

    const tBot: MWBot | undefined = await getDefaultBot();
    if (!tBot) {
        return undefined;
    }

    const baseHref: string = config.get("transferProtocol") + host + config.get("articlePath");

    getViewParse("pageViewer", "WikiViewer", args, tBot, baseHref);
}

/**
 *
 * @param currentPanel where to show
 * @param viewerTitle viewer title
 * @param args post args
 * @param tBot account
 * @param baseURI url base
 * @returns task
 */
export async function getViewParse(currentPanel: vscode.WebviewPanel | string, viewerTitle: string, args: Record<string, string>, tBot: MWBot, baseURI: string): Promise<void> {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wikitext");

    const barMessage: vscode.Disposable = vscode.window.setStatusBarMessage(i18n("wikitext-preview", lang));
    try {
        const result: unknown = await tBot.request(args);
        const re: GetViewResult = ViewConverter.toGetViewResult(result);
        if (!re.parse) { return undefined; }

        const baseElem = `<base href="${baseURI}" />`;

        const style = `<style>${config.get("previewCssStyle")}</style>`;

        const htmlHead: string = re.parse.headhtml?.["*"]?.replace("<head>", "<head>" + baseElem + style) ?? `<!DOCTYPE html><html><head>${baseElem + style}</head><body>`;
        const htmlText: string = re.parse.text?.["*"] ? `<div id="mw-content-text">${re.parse.text?.["*"]}</div>` : "";
        const htmlCategories: string = re.parse.categorieshtml?.["*"] || "";
        const htmlScript = "<script>(window.RLQ = window.RLQ || []).push(function () { mw.loader.load(['site', 'mediawiki.page.startup', 'mediawiki.page.ready']); });</script>";
        const htmlEnd = "</body></html>";

        const html: string = htmlHead + htmlText + htmlCategories + htmlScript + htmlEnd;

        showPreview(currentPanel, html, `${viewerTitle}: ${re.parse.displaytitle}`);
    }
    catch (error: any) {
        vscode.window.showErrorMessage(i18n("error", lang, error.info || error.message));
    }
    finally {
        barMessage.dispose();
    }
}

/**
 *
 * @param currentPanel where to show
 * @param viewerTitle viewer title
 * @param args post args
 * @param tBot account
 * @param baseURI url base
 * @returns task
 */
export async function getDiffParse(currentPanel: vscode.WebviewPanel | string, viewerTitle: string, args: Record<string, string>, tBot: MWBot, baseURI: string): Promise<void> {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wikitext");

    const barMessage: vscode.Disposable = vscode.window.setStatusBarMessage(i18n("wikitext-preview", lang));
    try {
        const result: unknown = await tBot.request(args);
        const re: ReadPageResult = ReadPageConvert.toReadPageResult(result);
        if (!re.query) { return undefined; }
        const page = re.query?.pages?.[Object.keys(re.query.pages)[0]];
        if (!page) { return undefined; }
        if (page.missing !== undefined || page.invalid !== undefined) {
            vscode.window.showWarningMessage(i18n("error-nonexist", lang,
                page.title ?? "",
                page.invalidreason ?? ""
            ));
            return undefined;
        }
        const revision = page.revisions?.[0];
        if (!revision) { return undefined; }

        const baseElem = `<base href="${baseURI}" />`;

        const style = `<style>${config.get("previewCssStyle")}</style>`;

        const diffCss = config.get("apiPath") ? `<link rel="stylesheet" href="${(<string>config.get("apiPath")).replace("api.php", "load.php")}?modules=mediawiki.diff.styles&only=styles" />` : "";

        const htmlHead = `<!DOCTYPE html><html><head>${baseElem + style + diffCss}</head><body>`;
        const htmlText: string = revision.diff?.["*"] ? `<div id="mw-content-text"><table class="diff"><colgroup><col class="diff-marker"><col class="diff-content"><col class="diff-marker"><col class="diff-content"></colgroup><tbody>${revision.diff?.["*"]}</tbody></table></div>` : "";
        const htmlEnd = "</body></html>";

        const html: string = htmlHead + htmlText + htmlEnd;

        showPreview(currentPanel, html, `${viewerTitle}: ${page.title}`);
    }
    catch (error: any) {
        vscode.window.showErrorMessage(i18n("error", lang, error.info || error.message));
    }
    finally {
        barMessage.dispose();
    }
}

function showPreview(currentPanel: vscode.WebviewPanel | string, content: string, title: string) {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wikitext");
    if (typeof (currentPanel) === "string") {
        currentPanel = vscode.window.createWebviewPanel(currentPanel, title, vscode.ViewColumn.Active, { enableScripts: config.get("enableJavascript") });
    }
    currentPanel.webview.html = content;
    currentPanel.title = title;
}