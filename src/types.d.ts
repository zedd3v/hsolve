export interface SolveService {
    name: "random" | "aws" | "azure" | "custom";
    awsAccessKey?: string;
    awsSecretAccessKey?: string;
    awsRegion?: string;
    azureApiKey?: string;
    azureEndpoint?: string;
    customUrl?: string;
}

export interface CustomRecognitionResult {
    success: boolean;
    message: {
        className: string;
    }[];
}

export interface SiteConfig {
    pass: boolean;
    c: {
        type: string;
        req: string;
    };
}

export interface ImageTask {
    datapoint_uri: string;
    task_key: string;
}

export interface ImageSolution {
    [key: string]: boolean;
}

export interface CaptchaTask {
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
    },
    request_type: string;
    requester_question: {
        en: string;
    };
    requester_question_example: string[],
    tasklist: ImageTask[];
    'bypass-message': string;
    c: {
        type: string;
        req: string;
    };
    generated_pass_UUID?: string;
}