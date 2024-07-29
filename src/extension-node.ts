/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Rowe Wilson Frederisk Holme. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { getPageViewFactory, getPreviewFactory, getDiffFactory } from './export_command/wikimedia_function/view';
import { loginFactory, logoutFactory } from './export_command/wikimedia_function/bot';
import { closeEditorFactory, postPageFactory, pullPageFactory, pullPageAndReplaceFactory } from './export_command/wikimedia_function/page';
import { baseUriProcess } from './export_command/uri_function/uri';
import { addWebCiteFactory } from './export_command/cite_function/web';
import { WikitextCommandRegistrar } from './export_command/commadRegistrar';

export function activate(context: vscode.ExtensionContext): void {
    console.log("Extension is active.");
    // extensionContext = context;
    // URI
    context.subscriptions.push(vscode.window.registerUriHandler({ handleUri: baseUriProcess }));

    const commandRegistrar = new WikitextCommandRegistrar(context);
    // Bot
    commandRegistrar.register('login', loginFactory);
    commandRegistrar.register('logout', logoutFactory);
    // Core
    commandRegistrar.register('readPage', pullPageFactory);
    commandRegistrar.register('readPageAndReplace', pullPageAndReplaceFactory);
    commandRegistrar.register('writePage', postPageFactory);
    commandRegistrar.register('closeEditor', closeEditorFactory);
    // View
    commandRegistrar.register('getPreview', getPreviewFactory);
    commandRegistrar.register('getDiff', getDiffFactory);
    commandRegistrar.register('viewPage', getPageViewFactory);
    // Cite
    commandRegistrar.register('citeWeb', addWebCiteFactory);
}

export function deactivate(): void {
    console.log("Extension is deactivate.");
}
