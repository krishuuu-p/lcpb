import path from 'path';
import * as vscode from 'vscode';

const supportedLanguages = ['cpp','py','py3'];

export const isValidLanguage = (srcPath: string): boolean => {
    return supportedLanguages.includes(
        path.extname(srcPath).split('.')[1],
    );
};

export const checkUnsupported = (srcPath: string): boolean => {
    if (!isValidLanguage(srcPath)) {
        vscode.window.showErrorMessage(
            `Unsupported file language. Only these types are valid: ${supportedLanguages}`,
        );
        return true;
    }
    return false;
};

export const getPreferenceFor = (pref : string) : any => {
    return vscode.workspace.getConfiguration('lcpf').get(pref);
};