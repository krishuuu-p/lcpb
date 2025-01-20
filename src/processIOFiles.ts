import * as vscode from 'vscode';
import * as fs from 'fs';
import { TestCaseResult } from './types';
import { v4 as uuidv4 } from 'uuid';
import { getViewProvider } from './extension';

export const getTestCaseFromFile = async (inputFile: string | null, outputFile: string | null) => {
    const id = uuidv4();
    let tcResult : TestCaseResult | undefined = {
        id,
        result: null,
        testcase: {
            input: '',
            output: '',
            id,
        }
    };

    try {
        if (inputFile === null) {
            vscode.window.showErrorMessage('Please select an input file.');
        }
        else if (!fs.existsSync(inputFile)) {
            vscode.window.showErrorMessage('Input file does not exist.');
            tcResult = undefined;
        }
        else {
            tcResult.testcase.input = fs.readFileSync(inputFile, 'utf8');
        }

        if (outputFile === null) {
            if (tcResult !== undefined) {
                tcResult.testcase.output = '';
            }
        }
        else if (!fs.existsSync(outputFile)) {
            vscode.window.showErrorMessage('Output file does not exist.');
            tcResult = undefined;
        }
        else {
            if (tcResult !== undefined) {
                tcResult.testcase.output = fs.readFileSync(outputFile, 'utf8');
            }
        }
    }
    catch (error) {
        vscode.window.showErrorMessage('Error reading file. Please try again.');
        tcResult = undefined;
    }

    if (tcResult !== undefined) {
        getViewProvider().postMessageToWebview({
            command: 'update-file-testcase',
            tcResult,
        });
        vscode.window.showInformationMessage('Testcase added successfully.');
    }
};