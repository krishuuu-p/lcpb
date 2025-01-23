import * as vscode from 'vscode';
import { getProbSaveLocation } from './saveProblem';
import { existsSync, readFileSync } from 'fs';
import { Problem } from './types';
import { getViewProvider } from './extension';
import { getProblemForDocument } from './utilities';

export const editorChanged = async (e: vscode.TextEditor | undefined) => {
    if (e === undefined) {
        getViewProvider().postMessageToWebview({
            command: 'new-problem',
            problem: undefined,
        });
        return;
    }

    if (e.document.uri.scheme !== 'file') {
        return;
    }

    const problem = getProblemForDocument(e.document);

    if (problem === undefined) {
        getViewProvider().postMessageToWebview({
            command: 'new-problem',
            problem: undefined,
        });
        return;
    }

    
    getViewProvider().postMessageToWebview({
        command: 'new-problem',
        problem,
    });
    
};

export const editorClosed = (e: vscode.TextDocument) => {
    const srcPath = e.uri.fsPath;
    const probPath = getProbSaveLocation(srcPath);

    if (!existsSync(probPath)) {
        return;
    }

    const problem: Problem = JSON.parse(readFileSync(probPath).toString());

    if (getViewProvider().problemPath === problem.srcPath) {
        getViewProvider().postMessageToWebview({
            command: 'new-problem',
            problem: undefined,
        });
    }
};

export const checkLaunchWebview = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    setTimeout(() => {
        editorChanged(editor);
    }, 500);
};
