import path from 'path';
import fs from 'fs';
import { Problem } from './types';
import crypto from 'crypto';
import { getPreferenceFor } from './utilities';

export const getProbSaveLocation = (srcPath: string): string => {
    const savePreference = getPreferenceFor('general.problemSaveLocation');
    const srcFileName = path.basename(srcPath);
    const srcFolder = path.dirname(srcPath);
    const hash = crypto
        .createHash('md5')
        .update(srcPath)
        .digest('hex')
        .substr(0);
    const baseProbName = `.${srcFileName}_${hash}.prob`;
    const probSaveLocation = path.join(srcFolder, '.lcpb', 'problems');
    if (savePreference && savePreference !== '') {
        return path.join(savePreference, baseProbName);
    }
    return path.join(probSaveLocation, baseProbName);
};

export const getProblem = (srcPath: string): Problem | undefined => {
    const probPath = getProbSaveLocation(srcPath);
    let problem: string;
    try {
        problem = fs.readFileSync(probPath).toString();
        return JSON.parse(problem);
    } catch (err) {
        return undefined;
    }
};

export const saveProblem = (srcPath: string, problem: Problem) => {
    const srcFolder = path.dirname(srcPath);
    const lcpbFolder = path.join(srcFolder, '.lcpb');

    if (getPreferenceFor('general.problemSaveLocation') === '') {
        if (!fs.existsSync(lcpbFolder)) {
            fs.mkdirSync(lcpbFolder);
            fs.mkdirSync(path.join(lcpbFolder, 'problems'));
        }
        else if (!fs.existsSync(path.join(lcpbFolder, 'problems'))) {
            fs.mkdirSync(path.join(lcpbFolder, 'problems'));
        }
    }
    const probPath = getProbSaveLocation(srcPath);
    try {
        fs.writeFileSync(probPath, JSON.stringify(problem));
    } catch (err) {
        throw new Error(err as string);
    }
};
