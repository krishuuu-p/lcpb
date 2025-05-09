import * as vscode from 'vscode';
import { getLeetcodeProblem } from './processLCUrl';
import { VSToWebViewMessage, WebviewToVSEvent } from './types';
import { runSingleTestcase } from './execution';
import { getTestCaseFromFile } from './processIOFiles';
import { fillCode, inputToStdin } from './parseCode';
import * as fs from 'fs';
import { saveProblem } from './saveProblem';
import { checkLaunchWebview, editorChanged, editorClosed } from './handleEditorChanges';
import { deleteProblemFile } from './utilities';

let viewProvider: ViewProvider;

export const getViewProvider = () => {
    return viewProvider;
};

class ViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(
            async (message: WebviewToVSEvent) => {
                console.log('Got from webview', message);
                switch (message.command) {
					case 'fetch-lc-problem': {
                        const urlInput = message.url;
                        getLeetcodeProblem(urlInput);
                        break;
                    }

                    case 'open-help-url': {
                        vscode.env.openExternal(vscode.Uri.parse('https://github.com/krishuuu-p/lcpb/blob/main/README.md'));
                        break;
                    }

                    case 'run-single-testcase': {
                        const problem = message.problem;
                        const id = message.id;
                        runSingleTestcase(problem, id);
                        break;
                    }

                    case 'select-file': {
                        const fileUri = await this.handleSelectFile();
                        if (fileUri) {
                            this.postMessageToWebview({
                                command: 'file-selected',
                                filePath: fileUri.fsPath,
                                fileType: message.fileType,
                            });
                        }
                        break;
                    }

                    case 'new-testcase-from-file': {
                        getTestCaseFromFile(message.inputFile, message.outputFile, message.problem);
                        break;
                    }

                    case 'error-from-webview': {
                        vscode.window.showErrorMessage(message.message);
                        break;
                    }

                    case 'copy-stdin': {
                        const stdin = inputToStdin(message.paramInputMap, message.problem);
                        if (stdin) {
                            vscode.env.clipboard.writeText(stdin);
                            vscode.window.showInformationMessage('Copied stdin to clipboard');
                        }
                        break;
                    }

                    case 'copy-driver-code': {
                        const problem = message.problem;
                        const code = fs.readFileSync(problem.srcPath, "utf-8");
                        const stdin = inputToStdin(message.paramInputMap, message.problem);
                        if (stdin) {
                            const driverCode = fillCode(code, problem, message.paramInputMap);
                            vscode.env.clipboard.writeText(driverCode);
                            vscode.window.showInformationMessage('Copied driver code to clipboard');
                        }
                        else {
                            vscode.window.showErrorMessage("Couldn't generate driver code.");
                        }
                        
                        break;
                    }

                    case 'copy-input': {
                        vscode.env.clipboard.writeText(message.input);
                        vscode.window.showInformationMessage('Copied input to clipboard');
                        break;
                    }

                    case 'save': {
                        saveProblem(message.problem.srcPath, message.problem);
                        break;
                    }

                    case 'delete-problem': {
                        deleteProblemFile(message.srcPath);
                        break;
                    }

                    default: {
                        console.error(
                            'Unknown event received from webview',
                        );
                    }
                }
            },
        );
    }

    private async handleSelectFile(): Promise<vscode.Uri | undefined> {
        const fileUris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'Text Files': ['txt'] },
            title: 'Select a Text File',
        });
        return fileUris?.[0];
    }

	public postMessageToWebview = async (message: VSToWebViewMessage) => {
        if (this._view && this._view.visible) {
            this._view.webview.postMessage(message);
            if (message.command === 'new-problem') {
                if (message.problem === undefined) {
                    this.problemPath = undefined;
                } else {
                    this.problemPath = message.problem.srcPath;
                }
            }
        }
    };

    public problemPath: string | undefined;

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist','app.css'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist','webview.js'));
		const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'codicon.css'));
	
		return `
			<!DOCTYPE html lang="EN">
			<html lang="en">
                <head>
                    <link rel="stylesheet" href="${styleUri}" />
                    <link rel="stylesheet" href="${codiconsUri}" />
                    <meta charset="UTF-8" />
                </head>
                <body>
                    <script>
                        const vscodeApi = acquireVsCodeApi();
                    </script>
                    <div id="app"></div>
                    <script src="${scriptUri}"></script>
                </body>
			</html>
		`;
	}
	
}

export function activate(context: vscode.ExtensionContext) {
	console.log('LeetCode Problem Buddy is now active!');

    viewProvider = new ViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('lcpb.webviewView', viewProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
            },
        )
    );

    checkLaunchWebview();

    vscode.workspace.onDidCloseTextDocument((e) => {
        editorClosed(e);
    });

    vscode.window.onDidChangeActiveTextEditor((e) => {
        editorChanged(e);
    });

    vscode.window.onDidChangeVisibleTextEditors((editors) => {
        if (editors.length === 0) {
            getViewProvider().postMessageToWebview({
                command: 'new-problem',
                problem: undefined,
            });
        }
    });
}

export function deactivate() { }
