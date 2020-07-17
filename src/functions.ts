import UserAgent from 'user-agents';
import * as http from "http";
import * as https from "https";
import { parse } from "url";
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import * as _ from "lodash";
import { Agents } from 'got';
export const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

export const generateUA = (deviceCategory: string = `desktop`) => new UserAgent([/Chrome/, { deviceCategory }]).toString();

export const generateMouse = (timestamp: number) => {
    const mouse = [];
    for (let i = 0, ts = timestamp; i < _.random(1000, 10000); i++) {
        ts += _.random(0, 10);
        mouse.push([_.random(0, 500), _.random(0, 500), ts]);
    }
    return mouse;
};

export const createAgents = (proxy: string): Agents => {
    return {
        http: new HttpProxyAgent(parse(proxy)) as unknown as http.Agent,
        https: new HttpsProxyAgent(parse(proxy)) as unknown as https.Agent,
    }
};