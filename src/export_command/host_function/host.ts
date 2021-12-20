/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Rowe Wilson Frederisk Holme. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { i18n, lang } from '../i18n_function/i18n';

export async function getHost(): Promise<string | undefined> {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wikitext");
    const host: string | undefined = config.get("host");
    // if host is existed, return it.
    if (host) { return host; }
    // else ask to edit
    const selection: string | undefined = await vscode.window.showWarningMessage(i18n("error-no-host-defined", lang), "Edit", "Cancel");
    // edit
    if (selection === 'Edit') {
        // show the input box
        const input: string | undefined = await vscode.window.showInputBox({
            prompt: i18n("enter-host-name", lang),
            placeHolder: "en.wikipedia.org",
            value: config.get("host") || "en.wikipedia.org",
            ignoreFocusOut: false
        });
        // if input is not null or empty, update setting and return input
        if (input) {
            config.update("host", input, true);
            return input;
        }
    }
    // or else return undefined
    return undefined;
}
