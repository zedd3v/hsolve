import got from "got";
import * as _ from "lodash";
import * as AWS from 'aws-sdk';
import { ComputerVisionClient } from "@azure/cognitiveservices-computervision";
import { ApiKeyCredentials } from "@azure/ms-rest-js";
import { ImageTask, ImageSolution, SolveService } from './index';

interface CustomRecognitionResult {
    success: boolean;
    message: {
        className: string;
    }[];
}

const initiateAWSClient = (awsAccessKey: string, awsSecretAccessKey: string, awsRegion: string) => {
    const config = new AWS.Config({
        credentials: new AWS.Credentials({ accessKeyId: awsAccessKey, secretAccessKey: awsSecretAccessKey }),
        region: awsRegion
    });
    if (!AWS.config.region) {
        AWS.config.update({
            region: awsRegion,
        });
    }
    return new AWS.Rekognition();
};

const getRawImage = async (url: string): Promise<Buffer> => {
    const { rawBody } = await got(url, { encoding: null });
    return rawBody;
};


const awsRekognition = async (awsClient: AWS.Rekognition, bytes: Buffer): Promise<AWS.Rekognition.Label[]> => {
    return new Promise((resolve, reject) => {
        awsClient.detectLabels({
            Image: {
                Bytes: bytes
            },
            MaxLabels: 5
        }, (e, res) => {
            if (e) reject(e);
            resolve(res.Labels);
        });
    });
}

const classify = async (solveService: SolveService, image: ImageTask, question: string): Promise<ImageSolution> => {
    let retryLimit = 0;
    try {
        if (solveService.name === "azure") {

            const computerVisionClient = new ComputerVisionClient(
                new ApiKeyCredentials({
                    inHeader: {
                        'Ocp-Apim-Subscription-Key': solveService.azureApiKey,
                    },
                }),
                solveService.azureEndpoint,
            );
            let solve = await computerVisionClient.describeImage(image.datapoint_uri);
            return {
                [image.task_key]: solve.tags.includes(question),
            };

        } else if (solveService.name === "aws") {

            const imageRaw = await getRawImage(image.datapoint_uri);
            const { awsAccessKey, awsSecretAccessKey, awsRegion } = solveService;
            const awsClient = initiateAWSClient(awsAccessKey, awsSecretAccessKey, awsRegion);
            const solve = await awsRekognition(awsClient, imageRaw);
            return {
                [image.task_key]: solve.some(e => e.Name.toLowerCase().includes(question)),
            }

        } else if (solveService.name === "custom") {

            const { body }: { body: CustomRecognitionResult } = await got(solveService.customUrl, {
                searchParams: {
                    imageurl: image.datapoint_uri
                },
                responseType: `json`,
            });
            return {
                [image.task_key]: body.success ? body.message.some(s => s.className.includes(question)) : false,
            };

        } else if (solveService.name === "random") {

            return {
                [image.task_key]: _.sample([true, false]),
            };

        }
    } catch (e) {
        return retryLimit > 5 ? false : retryLimit--, classify(solveService, image, question);
    }
}

export const classifyImages = async (solveService: SolveService, images: ImageTask[], question: string): Promise<ImageSolution[]> => {
    try {
        const promises = [];
        for (let i = 0; i < images.length; i++) {
            promises.push(classify(solveService, images[i], question));
        }
        return Promise.all(promises);
    } catch (e) {
        throw new Error(e);
    }
}