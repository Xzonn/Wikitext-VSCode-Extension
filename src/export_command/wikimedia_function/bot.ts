/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Rowe Wilson Frederisk Holme. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import MWBot from 'mwbot';
import * as vscode from 'vscode';
import { getHost } from '../host_function/host';
import { i18n, lang } from '../i18n_function/i18n';
import { Action } from './args';
import { showMWErrorMessage } from './err_msg';

let bot: MWBot | undefined;

export async function login(): Promise<boolean> {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wikitext");

    const host: string | undefined = await getHost();
    if (!host) { return false; }

    const userInfo: { username?: string; password?: string } = {
        username: config.get('userName'),
        password: config.get('password')
    };

    if (!userInfo.username || !userInfo.password) {
        vscode.window.showWarningMessage(i18n("error-no-username-or-password", lang));
        return false;
    }

    bot = new MWBot({
        apiUrl: config.get("transferProtocol") + host + config.get("apiPath")
    });
    const barMessage: vscode.Disposable = vscode.window.setStatusBarMessage(i18n("wikitext-login", lang));
    try {
        const response: any = await bot.login(userInfo);
        // TODO:
        vscode.window.showInformationMessage(i18n("login-result-success", lang, response.lgusername, response.lguserid, i18n(response.result, lang), response.token));
        return true;
    }
    catch (error) {
        bot = undefined;
        showMWErrorMessage('login', error);
        return false;
    }
    finally {
        barMessage.dispose();
    }
}

export async function logout(): Promise<void> {
    await bot?.getEditToken();
    const barMessage: vscode.Disposable = vscode.window.setStatusBarMessage(i18n("wikitext-logout", lang));
    try {
        // it will be {} if success
        await bot?.request({
            'action': Action.logout,
            'token': bot.editToken
        });
        // clear bot
        bot = undefined;
        vscode.window.showInformationMessage(i18n("logout-result-success", lang));
    }
    catch (error) {
        showMWErrorMessage('logout', error);
    }
    finally {
        barMessage.dispose();
    }
}

export async function getDefaultBot(): Promise<MWBot | undefined> {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wikitext");
    let tBot: MWBot;
    if (bot) {
        tBot = bot;
    } else {
        // get host
        const host: string | undefined = await getHost();
        if (!host) { return undefined; }
        tBot = new MWBot({
            apiUrl: config.get("transferProtocol") + host + config.get("apiPath")
        });
    }
    return tBot;
}

export async function getLoggedInBot(): Promise<MWBot | undefined> {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wikitext");
    if (bot === undefined) {
        switch (config.get('autoLogin')) {
            case 'Always':
                return await login() ? bot : undefined;
            case 'Never':
                vscode.window.showWarningMessage(i18n("error-no-logged-in", lang));
                return undefined;
            case 'Ask me':
            default:
                switch (await vscode.window.showWarningMessage(i18n("login-ask", lang), i18n("button-yes", lang), i18n("button-no", lang), i18n("button-always", lang), i18n("button-never", lang))) {
                    case i18n("button-always", lang):
                        config.update('autoLogin', 'Always', true);
                        return await login() ? bot : undefined;
                    case i18n("button-yes", lang):
                        return await login() ? bot : undefined;
                    case i18n("button-never", lang):
                        config.update('autoLogin', 'Never', true);
                        return undefined;
                    case i18n("button-no", lang):
                    case undefined:
                    default:
                        return undefined;
                }
        }
    }
    return bot;
}