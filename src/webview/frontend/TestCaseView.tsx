import React, { useEffect, useState } from 'react';
import { TestCaseResult, Problem, WebviewToVSEvent, RunResult } from '../../types';

declare const vscodeApi: {
    postMessage: (message: WebviewToVSEvent) => void;
};

export function TestCaseView(props: { 
    key: string;
    problem: Problem;
    tcResult: TestCaseResult; 
    num: number; 
    handleSingleRun: (id: string, input: string, output: string) => void; 
    runAllCalled: boolean;
    handleSingleDelete: (id: string) => void;
}) {
    const tcResult = props.tcResult;
    const num = props.num;
    const [inputValue, setInputValue] = useState(tcResult.testcase.input);
    const [outputValue, setOutputValue] = useState(tcResult.testcase.output);
    const [isRunning, setIsRunning] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const autoResize = (textarea: HTMLTextAreaElement) => {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        autoResize(e.target);
    };

    const handleOutputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setOutputValue(e.target.value);
        autoResize(e.target);
    };

    const handleAutoResize = () => {
        const inputTextarea = document.getElementById(`input-textarea-${props.num}`) as HTMLTextAreaElement;
        const outputTextarea = document.getElementById(`output-textarea-${props.num}`) as HTMLTextAreaElement;
        const recOutputTextarea = document.getElementById(`received-output-textarea-${props.num}`) as HTMLTextAreaElement;

        if (inputTextarea) autoResize(inputTextarea);
        if (outputTextarea) autoResize(outputTextarea);
        if (recOutputTextarea) autoResize(recOutputTextarea);
    }

    useEffect(() => {
        if (!isMinimized) {
            handleAutoResize();
        }
    }, [isMinimized])

    useEffect(() => {
        if (isRunning) {
            setIsMinimized(true);
        }
    }), [isRunning]

    useEffect(() => {
        if (tcResult.result !== null) {
            setIsRunning(false);
            tcResult.result.passed ? setIsMinimized(true) : setIsMinimized(false);
        }
    }, [props.tcResult.result]);

    const handleSingleRun = () => {
        setIsRunning(true);
        props.handleSingleRun(props.tcResult.id, inputValue, outputValue);
    }

    useEffect(() => {
        if (props.runAllCalled) {
            handleSingleRun();
        }
    }, [props.runAllCalled]);

    const handleSingleDelete = () => {
        props.handleSingleDelete(props.tcResult.id);
    }

    const handleCopyStdin = () => {
        vscodeApi.postMessage({
            command: 'copy-stdin',
            paramInputMap: tcResult.testcase.paramInputMap,
            problem: props.problem,
        });
    }
    const handleCopyDriverCode = () => {
        vscodeApi.postMessage({
            command: 'copy-driver-code',
            paramInputMap: tcResult.testcase.paramInputMap,
            problem: props.problem,
        });
    }

    const handleCopyInput = () => {
        vscodeApi.postMessage({
            command: 'copy-input',
            input: inputValue,
        });
    }

    const toggleMinimizedState = () => {
        setIsMinimized(!isMinimized);
    }

    return (
        <>
            <div className="case-header">
                <div className="case-title" onClick={toggleMinimizedState}>
                    {isMinimized && (
                        <span 
                            className = "icon"
                            onClick={() => setIsMinimized(false)}
                            title='Expand'
                        >
                            <i className='codicon codicon-chevron-right'></i>
                        </span>
                    )}
                    {!isMinimized && (
                        <span 
                            className = "icon"
                            onClick={() => setIsMinimized(true)}
                            title='Minimize'
                        >
                            <i className='codicon codicon-chevron-down'></i>
                        </span> 
                    )}

                    <span>Test Case: {num}</span>
                </div>

                {isRunning && (
                    <div className='case-running-text'>
                        <span>Running...</span>
                    </div>
                )}

                {tcResult.result && !isRunning && !tcResult.result.timeout && (
                    <div className = {tcResult.result.passed ? 'case-passed-text' : 'case-failed-text'}>
                        <span>{tcResult.result.passed ? 'Passed' : 'Failed'}</span>
                    </div>
                )}

                {tcResult.result && !isRunning && tcResult.result.timeout && (
                    <div className = 'case-timeout-text'>
                        <span>Timed Out</span>
                    </div>
                )}

                <div className="case-buttons">
                    <button
                        className="btn btn-green btn-circle"
                        title="Run this testcase"
                        onClick= {handleSingleRun} 
                    >
                        <span className="icon">
                            <i className="codicon codicon-play"></i>
                        </span>
                    </button>
                    
                    <button
                        className="btn btn-red btn-circle"
                        title="Delete this testcase"
                        onClick = {handleSingleDelete}
                    >
                        <span className="icon">
                            <i className="codicon codicon-trash"></i>
                        </span>
                    </button>
                </div>
            </div>
            {!isMinimized && (
            <>
                <div className = 'copy-buttons'>
                    <div
                        className="btn btn-blue"
                        title="Copy below input to clipboard"
                        onClick={handleCopyInput}
                    >
                        <span className="icon">
                            <i className="codicon codicon-copy"></i>
                        </span>{' '}
                        Copy Input
                    </div>
                    <div
                        className="btn btn-blue"
                        title="Copy generated input for this testcase to clipboard"
                        onClick={handleCopyStdin}
                    >
                        <span className="icon">
                            <i className="codicon codicon-copy"></i>
                        </span>{' '}
                        Copy Stdin
                    </div>
                    <div
                        className="btn btn-blue"
                        title="Copy generated driver code for this testcase to clipboard"
                        onClick={handleCopyDriverCode}
                    >
                        <span className="icon">
                            <i className="codicon codicon-copy"></i>
                        </span>{' '}
                        Copy Driver Code
                    </div>
                </div>
                <div className = "case-data">
                    <div className="row">
                        <div>
                            <span>
                                <span className="input">Input</span>
                                <textarea
                                    id={`input-textarea-${props.num}`}
                                    value={inputValue.length > 300 ? inputValue.substring(0, 300) + '...' : inputValue}
                                    onChange={handleInputChange}
                                    className="case-textarea"
                                />
                            </span>
                        </div>
                    </div>
                    <div className="row">
                        <div>
                            <span>
                                <span className = "expected-output">Expected Output</span>
                                <textarea
                                    id={`output-textarea-${props.num}`}
                                    value={outputValue.length > 300 ? outputValue.substring(0, 300) + '...' : outputValue}
                                    onChange={handleOutputChange}
                                    className="case-textarea"
                                />
                            </span>
                        </div>
                    </div>
                    {tcResult.result !== null && (
                        <div className="row">
                            <div>
                                <span>
                                    <span className = "expected-output">Received Output</span>
                                    <textarea readOnly
                                        id={`received-output-textarea-${props.num}`}
                                        value={tcResult.result.stdout.length > 300 ? tcResult.result.stdout.substring(0, 300) + '...' : tcResult.result.stdout}
                                        className="case-textarea"
                                    />
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </>
            )}
        </>
    );
}
