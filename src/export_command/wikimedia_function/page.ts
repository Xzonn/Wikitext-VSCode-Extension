/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Rowe Wilson Frederisk Holme. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type MWBot from 'mwbot';
import { Action, Prop, RvProp, alterNativeValues, List } from './args';
import { ReadPageConvert, ReadPageResult, Main, Revision, Jump, Page } from '../../interface_definition/api_interface/readPage';
import { OldTokensConvert, OldTokensResult } from '../../interface_definition/api_interface/oldTokens';
import { compareVersion, getDefaultBot, getLoggedInBot } from './bot';
import { TokensConvert, TokensResult } from '../../interface_definition/api_interface/tokens';
import { showMWErrorMessage } from './err_msg';
import { TagsConvert, TagsResult } from '../../interface_definition/api_interface/tags';
import { lang, i18n } from '../i18n_function/i18n';

interface ContentInfo {
    content: string;
    info?: Record<string, string | undefined>;
}

export function postPageFactory() {
    /**
     * Write/Post Page
     */
    return async function postPage(): Promise<void> {
        async function getEditToken(bot: MWBot): Promise<string> {
            const errors: unknown[] = [undefined, undefined];
            try {
                const args: Record<string, string> = {
                    action: Action.query,
                    meta: 'tokens',
                    type: 'csrf'
                };
                const result: unknown = await bot.request(args);
                const reNew: TokensResult = TokensConvert.toResult(result);
                const token: string | undefined = reNew.query?.tokens?.csrftoken;
                if (token) {
                    return token;
                }
            }
            catch (error) {
                errors[0] = error;
            }
            if (errors[0] !== undefined) {
                try {
                    const args: Record<string, string> = {
                        action: "tokens",
                        type: "edit"
                    };
                    const result: unknown = await bot.request(args);
                    const reOld: OldTokensResult = OldTokensConvert.toResult(result);
                    const token: string | undefined = reOld.tokens?.edittoken;
                    if (token) {
                        return token;
                    }
                }
                catch (error) {
                    errors[1] = error;
                }
            }

            const error: Error = new Error(i18n("error-getting-token", lang, (errors[0] instanceof Error) ? errors[0].message : '', (errors[1] instanceof Error) ? errors[1].message : ''));
            throw error;
        }

        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('wikitext');
        const tBot: MWBot | undefined = await getLoggedInBot();

        if (tBot === undefined) {
            vscode.window.showErrorMessage(i18n("error-no-logged-in", lang));
            return undefined;
        }

        const document = vscode.window.activeTextEditor?.document;
        const wikiContent: string | undefined = document?.getText();
        if (wikiContent === undefined) {
            vscode.window.showWarningMessage(i18n("error-no-active-editor", lang));
            return undefined;
        }

        const contentInfo: ContentInfo = getContentInfo(wikiContent);

        const skip: boolean = config.get("skipEnteringPageTitle") as boolean;

        const defaultTitle = contentInfo.info?.pageTitle ?? (document?.isUntitled ? undefined : document?.fileName.split(/[\/\\]/).reverse()[0].split(".")[0]);

        const wikiTitle: string | undefined = skip && contentInfo.info?.pageTitle || await vscode.window.showInputBox({
            value: defaultTitle,
            ignoreFocusOut: true,
            prompt: i18n("enter-page-name", lang),
        });

        if (!wikiTitle) {
            vscode.window.showWarningMessage(i18n("error-no-title-given", lang));
            return undefined;
        }
        const wikiSummary: string | undefined = (await vscode.window.showInputBox({
            value: "",
            ignoreFocusOut: true,
            prompt: i18n("enter-summary", lang),
            placeHolder: i18n("edit-summary-placeholder", lang),
        }) || "") + i18n("edit-summary-placeholder", lang).trim();

        const barMessage: vscode.Disposable = vscode.window.setStatusBarMessage(i18n("wikitext-edit", lang));
        try {
            const args: Record<string, string> = {
                action: Action.edit,
                title: wikiTitle,
                text: contentInfo.content,
                summary: wikiSummary,
                // tags: 'WikitextExtensionForVSCode',
                token: await getEditToken(tBot)
            };
            const wikitextTag = 'WikitextExtensionForVSCode';
            const tagList: (number | string)[] = await getValidTagList(tBot);
            if (tagList.includes(wikitextTag)) {
                args['tags'] = wikitextTag;
            }

            // if (config.get("redirect")) {
            //     args['redirect'] = "true";
            // }
            const result: any = await tBot.request(args);
            // TODO: Convert
            if (result.edit.nochange !== undefined) {
                vscode.window.showWarningMessage(i18n("edit-result-nochange", lang,
                    result.edit.title,
                    result.edit.pageid,
                    result.edit.result,
                    result.edit.contentmodel,
                    result.edit.watched ? i18n("true", lang) : i18n("false", lang)
                ));
            } else {
                vscode.window.showInformationMessage(i18n("edit-result-success", lang,
                    result.edit.title,
                    result.edit.pageid,
                    result.edit.result,
                    result.edit.contentmodel,
                    result.edit.watched ? i18n("true", lang) : i18n("false", lang),
                    result.edit.oldrevid,
                    result.edit.newrevid,
                    new Date(result.edit.newtimestamp).toLocaleString()
                ));
            }
        }
        catch (error: any) {
            showMWErrorMessage('postPage', error, `Your Token: ${tBot?.editToken}.`);
        }
        finally {
            barMessage.dispose();
        }
    };
}

export function pullPageFactory() {
    return (() => pullPageHelper(false));
}

export function pullPageAndReplaceFactory(){
    return (() => pullPageHelper(true));
}

async function pullPageHelper(replace: boolean): Promise<void> {
    /**
     * Read/Pull Page
     */
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wikitext");

    // constructing
    const tBot: MWBot | undefined = await getDefaultBot();
    if (tBot === undefined) { return undefined; }

    // info
    const document = vscode.window.activeTextEditor?.document;
    let defaultTitle: string | undefined;
    if (replace && document) {
        const sourceText = document.getText();
        const info = getContentInfo(sourceText);
        defaultTitle = info.info?.pageTitle ?? (document?.isUntitled ? undefined : document?.fileName.split(/[\/\\]/).reverse()[0].split(".")[0]);
    }

    // get title name
    const title: string | undefined = await vscode.window.showInputBox({
        prompt: i18n("enter-page-name", lang),
        value: defaultTitle,
        ignoreFocusOut: true
    });
    // if title is null or empty, do nothing
    if (!title) { return undefined; }

    const newVer = await compareVersion(tBot, 1, 32, 0);

    if (!newVer) {
        vscode.window.showWarningMessage("Your MediaWiki version may be too old. This may cause some compatibility issues. Please update to the v1.32.0 or later.");
        // return undefined;
    }

    const args: Record<string, string> = {
        action: Action.query,
        prop: Prop.reVisions,
        rvprop: alterNativeValues(RvProp.content, RvProp.ids),
        rvslots: "*",
        titles: title
    };
    args['redirects'] = config.get("redirects") ? "1" : "0";
    args['converttitles'] = config.get("converttitles") ? "1" : "0";

    getPageCode(args, tBot, replace);
}

export function closeEditorFactory() {
    return async function closeEditor(): Promise<void> {
        const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;

        await editor?.edit((editBuilder: vscode.TextEditorEdit): void =>
            // delete all text
            editBuilder.delete(
                new vscode.Range( // the range of all document: from the beginning to the end
                    new vscode.Position(0, 0), // beginning
                    editor.document.lineAt(editor.document.lineCount - 1).rangeIncludingLineBreak.end // end
                )
            )
        ).then(() =>
            // close the activate editor
            vscode.commands.executeCommand('workbench.action.closeActiveEditor')
        );
    };
}

type PageInfo = "pageTitle" | "pageID" | "revisionID" | "contentModel" | "contentFormat";

export async function getPageCode(args: Record<string, string>, tBot: MWBot, replace = false): Promise<vscode.TextDocument | undefined> {
    function modelNameToLanguage(modelName: string | undefined): string {
        switch (modelName) {
            case undefined:
                return 'wikitext';
            case 'flow-board':
                return 'jsonc';
            case 'sanitized-css':
                return 'css';
            case 'Scribunto':
                return 'lua';
            default:
                return modelName;
        }
    }
    function getInfoHead(info: Record<PageInfo, string | undefined>): string {
        const commentList: Record<string, [string, string] | undefined> = {
            wikitext: ["", ""],
            jsonc: ["/*", "*/"],
            lua: ["--[=[", "--]=]"],
            javascript: ["/*", "*/"],
            css: ["/*", "*/"],
            php: ["/*", "*/"],
            // 'flow-board': ["/*", "*/"],
            // 'sanitized-css': ["/*", "*/"],
            // 'Scribunto' : ["--[=[", "--]=]"],
        };
        const headInfo: Record<string, string | undefined> = {
            comment: i18n("page-info-comment", lang),
            ...info
        };
        const infoLine: string = Object.keys(headInfo).
            map((key: string) => `    ${key} = #${headInfo[key] ?? ''}#`).
            join("\r");
        console.log(info?.contentModel);
        const comment: [string, string] | undefined = commentList[modelNameToLanguage(info?.contentModel)];
        if (comment === undefined) {
            throw new Error(`Unsupported content model: ${info?.contentModel}. Please report this issue to the author of this extension.`);
        }
        return comment.join(`<%-- [PAGE_INFO]
${infoLine}
[END_PAGE_INFO] --%>`);
    }

    const barMessage: vscode.Disposable = vscode.window.setStatusBarMessage(i18n("wikitext-raw", lang));
    try {
        // get request result
        const result: unknown = await tBot.request(args);
        // console.log(result);
        // Convert result as class
        const re: ReadPageResult = ReadPageConvert.toResult(result);
        if (re.query?.interwiki) {
            vscode.window.showWarningMessage(i18n("error-interwiki", lang,
                re.query.interwiki[0].title ?? "",
                re.query.interwiki[0].iw ?? ""
            ));
        }

        // get first page
        const page: Page | undefined = re.query?.pages?.[Object.keys(re.query.pages)[0]];
        // need a page elements
        if (!page) { return undefined; }

        if (page.missing !== undefined || page.invalid !== undefined) {
            const yes = i18n("button-yes", lang);
            const choice: string | undefined = await vscode.window.showWarningMessage(i18n("error-nonexist", lang,
                page.title ?? "",
                page.invalidreason ?? ""
            ), yes, i18n("button-no", lang));
            if (choice === yes) {
                const info: Record<PageInfo, string | undefined> = {
                    pageTitle: page.title,
                    pageID: undefined,
                    revisionID: undefined,
                    contentModel: undefined,
                    contentFormat: undefined,
                };
                const infoHead: string = getInfoHead(info);
                const textDocument: vscode.TextDocument = await vscode.workspace.openTextDocument({
                    language: info.contentModel ?? 'wikitext',
                    content: infoHead + "\r\r"
                });
                return textDocument;
            } else { return undefined; }
        }
        // first revision
        const revision: Revision | undefined = page.revisions?.[0];

        const content: Main | Revision | undefined = revision?.slots?.main || revision;

        const info: Record<PageInfo, string | undefined> = {
            pageTitle: page.title,
            pageID: page.pageid?.toString(),
            revisionID: revision?.revid?.toString(),
            contentModel: content?.contentmodel,
            contentFormat: content?.contentformat
        };
        const infoHead: string = getInfoHead(info);

        const editor = vscode.window.activeTextEditor;
        if (replace && editor) {
            const document = editor.document;
            editor.edit((editorBuilder) => {
                editorBuilder.replace(
                    new vscode.Range(document.lineAt(0).range.start, document.lineAt(document.lineCount - 1).range.end),
                    infoHead + "\r\r" + content?.["*"]
                );
            });
        } else {
            const textDocument: vscode.TextDocument = await vscode.workspace.openTextDocument({
                language: modelNameToLanguage(info.contentModel),
                content: infoHead + "\r\r" + content?.["*"]
            });
            vscode.window.showTextDocument(textDocument);
        }

        const normalized: Jump | undefined = re.query?.normalized?.[0];
        const redirects: Jump | undefined = re.query?.redirects?.[0];

        vscode.window.showInformationMessage(i18n("pull-result-success", lang,
            page.title ?? "",
            content?.contentmodel ?? "",
            normalized ? i18n("from-to", lang, normalized.from ?? "", normalized.to ?? "") : i18n("false", lang),
            redirects ? i18n("from-to", lang, redirects.from ?? "", redirects.to ?? "") : i18n("false", lang)
        ));
    }
    catch (error) {
        showMWErrorMessage('getPageCode', error);
    }
    finally {
        barMessage.dispose();
    }
}

export function getContentInfo(content: string): ContentInfo {
    const info: string | undefined = content.match(
        /(?<=<%--\s*\[PAGE_INFO\])[\s\S]*?(?=\[END_PAGE_INFO\]\s*--%>)/
    )?.[0];

    let pageInfo: Record<PageInfo, string | undefined> | undefined;
    if (info) {
        const getInfo = (infoName: PageInfo): string | undefined => {
            const nameFirst: string = infoName[0];
            const nameRest: string = infoName.substring(1);
            const reg = new RegExp(`(?<=[${nameFirst.toLowerCase()}${nameFirst.toUpperCase()}]${nameRest}\\s*=\\s*#).*?(?=#)`);
            return info.match(reg)?.[0];
        };
        pageInfo = {
            pageTitle: getInfo("pageTitle"),
            pageID: getInfo("pageID"),
            revisionID: getInfo("revisionID"),
            contentModel: getInfo("contentModel"),
            contentFormat: getInfo("contentFormat")
        };

        content = content.replace(/\s*(?:\/\*|--\[=\[)?\s*<%--\s*\[PAGE_INFO\][\s\S]*?\[END_PAGE_INFO\]\s*--%>\s*(?:\*\/|--\]=\])?\s*/, '');
    }

    return { content: content, info: pageInfo };
}

async function getValidTagList(tBot: MWBot): Promise<(number | string)[]> {
    const args: Record<string, string> = {
        action: Action.query,
        list: List.tags,
        tglimit: 'max',
        tgprop: alterNativeValues('active', 'defined')
    };

    const tagList: (number | string)[] = [];
    for (; ;) {
        const result: unknown = await tBot.request(args);
        const re: TagsResult = TagsConvert.toResult(result);

        tagList.push(
            ...re.query.tags.filter(tag =>
                tag.active !== undefined && tag.defined !== undefined
            ).map(tag => tag.name));
        if (re.continue !== undefined) { Object.assign(args, re.continue); }
        else { break; }
    }

    return tagList;
}
