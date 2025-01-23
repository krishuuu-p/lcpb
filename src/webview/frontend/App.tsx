import React, { JSX, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
    Problem,
    TestCase,
    TestResult,
    TestCaseResult,
    WebviewToVSEvent,
    VSToWebViewMessage,
} from '../../types';
import { TestCaseView } from './TestCaseView';
import { v4 as uuidv4 } from 'uuid';

declare const vscodeApi: {
    postMessage: (message: WebviewToVSEvent) => void;
};

function Judge(props: {
    problem: Problem;
    updateProblem: (problem: Problem | undefined) => void;
    tcResults: TestCaseResult[];
    updateResults: (cases: TestCaseResult[]) => void;
}) {
    const problem = props.problem;
    const tcResults = props.tcResults;
    const updateProblem = props.updateProblem;
    const updateResults = props.updateResults;

    const [runAllCalled, setRunAllCalled] = useState<boolean>(false);
    const [showFileOptions, setShowFileOptions] = useState<boolean>(false);
    const [inputFile, setInputFile] = useState<string | null>(null);
    const [outputFile, setOutputFile] = useState<string | null>(null);
    const [isMinimized, setIsMinimized] = useState(true);

    const handleFileSelection = (type: 'input' | 'output') => {
        vscodeApi.postMessage({
            command: 'select-file',
            fileType: type,
        });
    };

    useEffect(() => {
        const handleMessage = (event: any) => {
            const data: VSToWebViewMessage = event.data;
            console.log('Got from extension ', data.command);
            switch (data.command) {
                case 'file-selected': {
                    const { fileType, filePath } = data;
                    if (fileType === 'input') {
                        setInputFile(filePath);
                    } else if (fileType === 'output') {
                        setOutputFile(filePath);
                    }

                    break;
                }

                case 'update-file-testcase': {
                    setShowFileOptions(false);
                    setInputFile(null);
                    setOutputFile(null);
                    break;
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    useEffect(() => {
        const testCases: TestCase[] = tcResults.map((tcResult) => tcResult.testcase);
        updateProblem({
            ...problem,
            tests: testCases,
        });
    }, [tcResults]);

    const handleSingleRun = (id: string, input: string, output: string) => {
        console.log('Running testcase', id, input, output);
        const index = props.problem.tests.findIndex((tc) => tc.id === id);
        if(index === -1) {
            console.error('Testcase not found');
            return;
        }
        const paramInputMap: Record<string, string> = problem.tests[index].paramInputMap;
        const inputLines = input.split('\n');
        for (const line of inputLines) {
            if (line.trim().length === 0) {
                continue;
            }

            // In case if user is writing their own stdin we don't want to throw an error
            if (!line.includes(':')) {
                continue;
            }
            const [paramName, value] = line.split(':').map((x) => x.trim());
            if (paramName in paramInputMap) {
                paramInputMap[paramName] = value;
            }
            else {
                const updatedTCResults = [...tcResults];
                const testResult: TestResult = {
                    id,
                    passed: false,
                    stdout: 'Parameter not found',
                    stderr: '',
                    code: null,
                    signal: null,
                    timeout: false,
                };
                updatedTCResults[index] = {
                    ...updatedTCResults[index],
                    result: testResult,
                };

                updateResults(updatedTCResults);
                console.error('Parameter not found:', paramName);
                vscodeApi.postMessage({
                    command: 'error-from-webview',
                    message: `Corresponding parameter not found in the function: '${paramName}' (TestCase ${index + 1}).`,
                });

                return;
            }
        }

        problem.tests[index].input = input;
        problem.tests[index].output = output;
        problem.tests[index].paramInputMap = paramInputMap;

        vscodeApi.postMessage({
            command: 'run-single-testcase',
            problem,
            id,
        });
    }

    const handleSingleDelete = (id: string) => {
        updateResults(tcResults.filter((tcResult) => tcResult.id !== id));
    }

    const handleNewTestCase = () => {
        const id = uuidv4();
        let input = '';
        for (const param of problem.parameters) {
            input += `${param.paramName}: \n`;
        }

        let paramInputMap: Record<string, string> = {};
        for (const param of problem.parameters) {
            paramInputMap[param.paramName] = '';
        }
        const newtcResult : TestCaseResult = {
            id,
            result: null,
            testcase: {
                input,
                output: '',
                paramInputMap,
                id,
            }
        }
        
        updateResults([...tcResults, newtcResult]);
    }

    const handleNewCaseFromFile = () => {
        vscodeApi.postMessage({
            command: 'new-testcase-from-file',
            inputFile,
            outputFile,
            problem,
        });
    }

    const handleRunAll = () => {
        setRunAllCalled(true);
    };

    const handleDeleteAll = () => {
        updateResults([]);
    };

    const handleDeleteProblem = () => {
        updateProblem(undefined);
        vscodeApi.postMessage({
            command: 'delete-problem',
            srcPath: problem.srcPath,
        });
    }

    useEffect(() => {
        if (runAllCalled) {
            const timer = setTimeout(() => setRunAllCalled(false), 100);
            return () => clearTimeout(timer);
        }
    }, [runAllCalled]);

    const tcViews: JSX.Element[] = tcResults.map((tcResult, index) => (
        <TestCaseView
            key={tcResult.id}
            problem={problem}
            tcResult={tcResult}
            num={index + 1}
            handleSingleRun={handleSingleRun}
            runAllCalled={runAllCalled}
            handleSingleDelete={handleSingleDelete}
        />
    ));

    const toggleMinimizedState = () => {
        setIsMinimized(!isMinimized);
    }

    return (
        <div style={{ margin: '10px' }}>
            <div className="problem-name">
                <span>{props.problem.name}</span>
            </div>
            <div className="problem-description-title" 
                onClick={toggleMinimizedState}
                title = {isMinimized ? 'Expand Problem Description' : 'Minimize Problem Description'}
            >
                {isMinimized && (
                    <span 
                        className = "icon"
                        onClick={() => setIsMinimized(false)}
                    >
                        <i className='codicon codicon-chevron-right'></i>
                    </span>
                )}
                {!isMinimized && (
                    <span 
                        className = "icon"
                        onClick={() => setIsMinimized(true)}
                    >
                        <i className='codicon codicon-chevron-down'></i>
                    </span> 
                )}

                <span>Problem Description</span>
            </div>
            {!isMinimized && (
                <div className = "problem-description-container">
                    <span
                    dangerouslySetInnerHTML={{ __html: problem.description }}
                    />
                </div>
            )}
            <div className='btn btn-block'
                title='Get TestCase from a local file'
                onClick={() => setShowFileOptions(!showFileOptions)}
            >
                <span className='icon'>
                    <i className='codicon codicon-file-code'></i>
                </span>{'  '}
                <span>Get TestCase from file</span>
            </div>
            {showFileOptions && (
                <>
                <div className="button-row">
                    <button
                        className="btn btn-green w48"
                        title="Get input file"
                        onClick={() => handleFileSelection('input')}
                    >
                        Attach input file
                    </button>
                    <button
                        className="btn btn-orange w48"
                        title="Get output file (Optional)"
                        onClick={() => handleFileSelection('output')}
                    >
                        Attach output file
                    </button>
                </div>
                {inputFile && 
                    <div className="file-info">
                        <p className="file-name">
                            Input File Selected: {inputFile.split('\\')[inputFile.split('\\').length - 1]}
                        </p>
                        <span className='btn' onClick={() => setInputFile(null)}>
                            Clear Input File
                        </span>
                    </div>
                }
                {outputFile && 
                    <div className="file-info">
                        <p className="file-name">
                            Output File Selected: {outputFile.split('\\')[outputFile.split('\\').length - 1]}
                        </p>
                        <span className='btn' onClick={() => setOutputFile(null)}>
                            Clear Output File
                        </span>
                    </div>
                }
                <button
                    className="btn btn-block"
                    disabled={!inputFile}
                    onClick={handleNewCaseFromFile}
                >
                    Add this testcase
                </button>
                </>
            )}
            <div>{tcViews}</div>
            <div className= "action-buttons">
                <div className= "button-row">
                    <button
                        className="btn btn-green w48"
                        title="Run all testcases"
                        onClick = {handleRunAll}
                    >
                        <span className="icon">
                            <i className="codicon codicon-play"></i>
                        </span>{' '}
                        Run All
                    </button>
                    <button
                        className="btn w48"
                        title="Add new testcase"
                        onClick={handleNewTestCase}
                    >
                        <span className="icon">
                            <i className="codicon codicon-plus"></i>
                        </span>{' '}
                        Add new TC
                    </button>
                </div>
                <div className= "button-row">
                    <button
                        className="btn btn-orange w48"
                        title="Delete all testcases"
                        onClick= {handleDeleteAll}
                    >
                        <span className="icon">
                            <i className="codicon codicon-trash"></i>
                        </span>{' '}
                        Delete All
                    </button>
                    <button
                        className="btn btn-red w48"
                        title="Delete the problem associated with this file and fetch another problem"
                        onClick= {handleDeleteProblem}
                    >
                        <span className="icon">
                            <i className="codicon codicon-trash"></i>
                        </span>{' '}
                        Delete Problem
                    </button>
                </div>
            </div>
        </div>
    )
}

function App() {
    const [problem, setProblem] = useState<Problem | undefined>(undefined);
    const [tcResults, setTCResults] = useState<TestCaseResult[]>([]);
    const [urlInput, setUrlInput] = useState<string>('');
    const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
    const [isFetching, setIsFetching] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [deferSaveTimer, setDeferSaveTimer] = useState<number | null>(null);
    const [, setSaving] = useState<boolean>(false);

    // Save the problem
    const save = () => {
        setSaving(true);
        if (problem !== undefined) {
            vscodeApi.postMessage({
                command: 'save',
                problem,
            });
        }
        setTimeout(() => {
            setSaving(false);
        }, 500);
    };

    // Save problem if it changes.
    useEffect(() => {
        if (deferSaveTimer !== null) {
            clearTimeout(deferSaveTimer);
        }
        const timeOutId = window.setTimeout(() => {
            setDeferSaveTimer(null);
            save();
        }, 500);
        setDeferSaveTimer(timeOutId);
    }, [problem]);


    useEffect(() => {
        const handleMessage = (event: any) => {
            const data: VSToWebViewMessage = event.data;
            console.log("Got from extension:", data.command);
            switch (data.command) {
                case 'new-problem': {
                    setProblem(data.problem);
                    setTCResults(getInitialResultsFromProblem(data.problem));
                    break;
                }
                case 'update-problem': {
                    setProblem(data.problem);
                    setTCResults(getInitialResultsFromProblem(data.problem));
                    setErrorMessage(null);
                    setIsFetching(false);
                    break;
                }
                case 'error-from-extension': {
                    setErrorMessage(data.message);
                    setIsFetching(false);
                    break;
                }
                case 'update-test-case-results': {
                    const testResult = data.testResult;
                    updateTestCaseResults(testResult);
                    break;
                }
                case 'update-file-testcase': {
                    const tcResult = data.tcResult;
                    const updatedTCResults = [...tcResults, tcResult];
                    setTCResults(updatedTCResults);
                    break;
                }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [tcResults]);

    const getInitialResultsFromProblem = (problem: Problem | undefined): TestCaseResult[] => {
        if (problem === undefined) {
            return [];
        }
    
        return problem.tests.map((testCase) => ({
            id: testCase.id,
            result: null,
            testcase: testCase,
        }));
    };

    const updateTestCaseResults = (testResult: TestResult) => {
        const id = testResult.id;
        const idx = tcResults.findIndex((tcResult) => tcResult.id === id);
        if (idx === -1) {
            console.error("TestCase not found.");
        }
        const updatedTCResults = [...tcResults];
        updatedTCResults[idx] = {
            ...updatedTCResults[idx],
            result: testResult,
        };

        setTCResults(updatedTCResults);
    }

    const handleUrlSubmit = () => {
        setIsFetching(true);
        setErrorMessage(null);

        vscodeApi.postMessage({
            command: 'fetch-lc-problem',
            url: urlInput,
        });

        setShowUrlInput(false);
        setUrlInput('');
    };

    if (problem === undefined) {
        return (
            <>
                <div>
                    <div className='welcome-text'>
                        <h1>Welcome to LeetCode Problem Buddy</h1>
                        <p>
                            This extension helps you to fetch LeetCode problems and run test cases on them.
                        </p>
                        <p>
                            Choose an action from below to get started.
                        </p>
                    </div>
                    <div 
                        className='btn btn-block btn-green help-text'
                        title= "How to use this extension"
                        onClick={() => vscodeApi.postMessage({ command: 'open-help-url' })}
                    >
                        <span className="icon">
                            <i className="codicon codicon-question"></i>
                        </span>{' '}
                        <span>How to use this extension?</span>
                    </div>
                    <div
                        className="btn btn-block"
                        onClick={() => setShowUrlInput(true)}
                        title="Fetch Leetcode problem test cases from problem URL"
                    >
                        <span className="icon">
                            <i className="codicon codicon-code"></i>
                        </span>{' '}
                        <span className="action-text">
                            Fetch Leetcode Problem
                        </span>
                    </div>

                    {showUrlInput && (
                        <div className="url-input">
                            <input className = "url-input-box"
                                type="text"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleUrlSubmit();
                                    }
                                }}
                                placeholder="Enter URL here"
                            />
                            <button onClick={handleUrlSubmit} className="btn">
                                Submit
                            </button>
                            {'  '}
                            <button
                                onClick={() => setShowUrlInput(false)}
                                className="btn"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {isFetching && (
                        <div className="fetching-message">
                            <p>Fetching Problem...</p>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="error-message">
                            <p>{errorMessage}</p>
                            <button
                                onClick={() => setErrorMessage(null)}
                                className="btn"
                            >
                                Dismiss
                            </button>
                        </div>
                    )}
                </div>
            </>
        );
    }
    else {
        return (
            <Judge
                problem={problem}
                updateProblem={setProblem}
                tcResults={tcResults}
                updateResults={setTCResults}
            />
        );
    }
}

const root = createRoot(document.getElementById('app')!);
root.render(<App />);