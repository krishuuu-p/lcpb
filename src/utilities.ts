import path from 'path';
import * as vscode from 'vscode';
import { Problem } from './types';
import { existsSync, readFileSync } from 'fs';
import { getProbSaveLocation } from './saveProblem';
import { platform } from 'os';
import { spawn } from 'child_process';

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
    return vscode.workspace.getConfiguration('lcpb').get(pref);
};

export const getProblemForDocument = (
    document: vscode.TextDocument | undefined,
): Problem | undefined => {
    if (document === undefined) {
        return undefined;
    }

    const srcPath = document.fileName;
    const probPath = getProbSaveLocation(srcPath);
    if (!existsSync(probPath)) {
        return undefined;
    }
    const problem: Problem = JSON.parse(readFileSync(probPath).toString());
    return problem;
};

export const deleteProblemFile = (srcPath: string) => {
    const probPath = getProbSaveLocation(srcPath);
    try {
        if (platform() === 'win32') {
            spawn('cmd.exe', ['/c', 'del', probPath]);
        } else {
            spawn('rm', [probPath]);
        }
    } catch (error) {
        console.error('Error while deleting problem file ', error);
    }
};