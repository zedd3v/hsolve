import got, { Agents } from "got";
import * as URL from "url";
import * as _ from "lodash";
import * as VM from "vm";
import { v4 as uuidv4 } from 'uuid';
import { generateUA, generateMouse, sleep, createAgents } from './functions';
import { SiteConfig, CaptchaTask, SolveService } from './types';
import { classifyImages } from './solve';

const siteConfig = async (host: string, siteKey: string, userAgent: string, agent?: Agents): Promise<SiteConfig["c"]> => {
    const { body } = await got(`https://hcaptcha.com/checksiteconfig`, {
        searchParams: {
            host,
            sitekey: siteKey,
            sc: 1,
            swa: 0,
        },
        headers: {
            "user-agent": userAgent,
        },
        responseType: `json`,
        agent,
    });
    return (body as SiteConfig).c;
};

const hsl = async (req: string) => {
    const { body } = await got(`https://assets.hcaptcha.com/c/500c658/hsl.js`);
    return new Promise((resolve, reject) => {
        VM.runInNewContext(`var self={};function atob(a){return new Buffer(a,'base64').toString('binary')} ${body} hsl('${req}').then(resolve).catch(reject)`, {
            Buffer,
            resolve,
            reject,
        });
    });
};

const getCaptcha = async (host: string, siteKey: string, userAgent: string, c: SiteConfig["c"], timestamp: number, agent?: Agents): Promise<CaptchaTask> => {
    const { body } = await got.post(`https://hcaptcha.com/getcaptcha`, {
        searchParams: {
            host,
            sitekey: siteKey,
            sc: 1,
            swa: 0,
        },
        headers: {
            "user-agent": userAgent,
        },
        responseType: `json`,
        form: {
            sitekey: siteKey,
            host,
            n: await hsl(c.req),
            c: JSON.stringify(c),
            motionData: {
                st: timestamp,
                dct: timestamp,
                mm: generateMouse(timestamp),
            },
        },
        agent,
    });
    return body as CaptchaTask;
};

const submitCaptcha = async (host: string, siteKey: string, userAgent: string, timestamp: number, key: string, jobType: string, answers: object, agent?: Agents): Promise<string> => {
    const { body }: { body: CaptchaTask } = await got.post(`https://hcaptcha.com/checkcaptcha/${key}`, {
        searchParams: {
            host,
            sitekey: siteKey,
            sc: 1,
            swa: 0,
        },
        headers: {
            "user-agent": userAgent,
        },
        responseType: `json`,
        form: {
            sitekey: siteKey,
            serverdomain: host,
            answers,
            job_mode: jobType,
            motionData: {
                st: timestamp,
                dct: timestamp,
                mm: generateMouse(timestamp),
            },
        },
        agent,
    });
    return body.generated_pass_UUID ? body.generated_pass_UUID : null;
};

const hsolve = async (url: string, options: { timeout?: number; solveService?: SolveService; proxy?: string; }): Promise<string> => {
    let { solveService, timeout, proxy } = options;
    if (!timeout) timeout = 120000;
    if (!proxy) proxy = null;
    if (!solveService) solveService = {
        name: "random",
    };

    const startTimestamp = Date.now();

    const timeoutCheck = setInterval(async () => {
        if (Date.now() - startTimestamp > timeout) throw new Error('HSolve Timeout');
    }, 500);

    const agents = proxy ? createAgents(proxy) : undefined;

    const { hostname } = URL.parse(url);
    const userAgent = generateUA();
    const siteKey = uuidv4();

    const c = await siteConfig(hostname, siteKey, userAgent, agents);

    const captchaTask = await getCaptcha(hostname, siteKey, userAgent, c, (Date.now() + _.random(30, 120)), agents);

    if (captchaTask.generated_pass_UUID) return captchaTask.generated_pass_UUID;

    const question = captchaTask.requester_question.en.includes("containing an") ? captchaTask.requester_question.en.split("Please click each image containing an ")[1] : captchaTask.requester_question.en.split("Please click each image containing a ")[1].toLowerCase();

    const answers = await classifyImages(solveService, captchaTask.tasklist, question);

    const solution = submitCaptcha(hostname, siteKey, userAgent, (Date.now() + _.random(30, 120)), captchaTask.key, captchaTask.request_type, answers, agents);

    if (solution) return clearInterval(timeoutCheck), solution;

    await sleep(3000);
    return hsolve(url, options);

};

export default hsolve;