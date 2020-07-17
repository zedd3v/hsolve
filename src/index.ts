import got, { Agents } from "got";
import * as URL from "url";
import _ from "lodash";
import * as VM from "vm";
import { v4 as uuidv4 } from "uuid";
import { generateUA, generateMouse, sleep, createAgents } from "./functions";
import classifyImages from "./classify";

export interface SolveService {
  name: "random" | "aws" | "azure" | "custom";
  awsAccessKey?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  azureApiKey?: string;
  azureEndpoint?: string;
  customUrl?: string;
}

export interface ImageTask {
  datapoint_uri: string;
  task_key: string;
}

export interface ImageSolution {
  [key: string]: boolean;
}

interface SiteConfig {
  pass: boolean;
  c: {
    type: string;
    req: string;
  };
}

interface CaptchaTask {
  challenge_uri: string;
  key: string;
  request_config: {
    version: number;
    shape_type: null;
    min_points: null;
    max_points: null;
    min_shapes_per_image: null;
    max_shapes_per_image: null;
    restrict_to_coords: null;
    minimum_selection_area_per_shape: null;
    multiple_choice_max_choices: number;
    multiple_choice_min_choices: number;
  };
  request_type: string;
  requester_question: {
    en: string;
  };
  requester_question_example: string[];
  tasklist: ImageTask[];
  "bypass-message": string;
  c: {
    type: string;
    req: string;
  };
  generated_pass_UUID?: string;
}

const siteConfig = async (
  host: string,
  siteKey: string,
  userAgent: string,
  agent?: Agents
): Promise<SiteConfig["c"]> => {
  try {
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
  } catch (e) {
    if (e.response && e.response.statusCode === 429) {
      await sleep(30000);
    } else {
      throw new Error(e);
    }
  }
};

const hsl = async (req: string) => {
  try {
    const { body } = await got(
      `https://assets.hcaptcha.com/c/500c658/hsl.js`
    );
    return new Promise((resolve, reject) => {
      VM.runInNewContext(
        `var self={};function atob(a){return Buffer.from(a,'base64').toString('binary')} ${body} hsl('${req}').then(resolve).catch(reject)`,
        {
          Buffer,
          resolve,
          reject,
        }
      );
    });
  } catch (e) {
    throw new Error(e);
  }
};

const getCaptcha = async (
  host: string,
  siteKey: string,
  userAgent: string,
  c: SiteConfig["c"],
  timestamp: number,
  agent?: Agents
): Promise<CaptchaTask> => {
  try {
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
  } catch (e) {
    if (e.response && e.response.statusCode === 429) {
      await sleep(30000);
    } else {
      throw new Error(e);
    }
  }
};

const submitCaptcha = async (
  host: string,
  siteKey: string,
  userAgent: string,
  timestamp: number,
  key: string,
  jobType: string,
  answers: {
    [key: string]: any;
  },
  agent?: Agents
): Promise<string> => {
  try {
    const { body }: { body: CaptchaTask } = await got.post(
      `https://hcaptcha.com/checkcaptcha/${key}`,
      {
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
      }
    );
    return body.generated_pass_UUID ? body.generated_pass_UUID : null;
  } catch (e) {
    if (e.response && e.response.statusCode === 429) {
      await sleep(30000);
    } else {
      throw new Error(e);
    }
  }
};

const hsolve = async (
  url: string,
  options: {
    timeout?: number;
    solveService?: SolveService;
    proxy?: string;
  } = {}
): Promise<string> => {
  try {
    let { solveService, timeout, proxy } = options;
    if (timeout === undefined) timeout = 12000000;
    if (!proxy) proxy = null;
    if (!solveService)
      solveService = {
        name: "random",
      };

    const startTimestamp = Date.now();

    const timeoutCheck =
      timeout !== null
        ? setInterval(() => {
          if (Date.now() - startTimestamp > timeout) {
            clearInterval(timeoutCheck);
            throw new Error("hSolve Timeout");
          }
        }, 200)
        : null;

    const agents = proxy ? createAgents(proxy) : undefined;

    const { hostname } = URL.parse(url);
    const userAgent = generateUA();
    const siteKey = uuidv4();

    const c = await siteConfig(hostname, siteKey, userAgent, agents);

    const captchaTask = await getCaptcha(
      hostname,
      siteKey,
      userAgent,
      c,
      Date.now() + _.random(30, 120),
      agents
    );

    if (captchaTask.generated_pass_UUID)
      return captchaTask.generated_pass_UUID;

    const question = captchaTask.requester_question.en.includes(
      "containing an"
    )
      ? captchaTask.requester_question.en.split(
        "Please click each image containing an "
      )[1]
      : captchaTask.requester_question.en
        .split("Please click each image containing a ")[1]
        .toLowerCase();

    const answers = (await classifyImages(
      solveService,
      captchaTask.tasklist,
      question
    )).reduce((obj, ans) => Object.assign(obj, { [Object.keys(ans)[0]]: ans[Object.keys(ans)[0]] }), {});

    const solution = await submitCaptcha(
      hostname,
      siteKey,
      userAgent,
      Date.now() + _.random(30, 120),
      captchaTask.key,
      captchaTask.request_type,
      answers,
      agents
    );

    if (solution) {
      clearInterval(timeoutCheck);
      return solution;
    }

    await sleep(3000);
    return hsolve(url, {
      solveService,
      timeout: null,
      proxy,
    });
  } catch (e) {
    throw new Error(e);
  }
};

export default hsolve;

// CommonJS support for default export
module.exports = hsolve;
module.exports.default = hsolve;
module.exports.__esModule = true;
