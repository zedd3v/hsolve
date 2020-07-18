# hSolve

A library for solving HCaptcha.

## Installation

```bash
$ npm install hsolve
```

## Usage

```javascript
const hsolve = require('hsolve');

// Typescript: import hsolve from 'hsolve';

/* RANDOM SOLUTIONS */

const token = await hsolve("https://captcha.website/"); // => P0_eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJwYXNza2V...


/* AWS */

const token = await hsolve("https://captcha.website/", {
    solveService: {
        name: "aws",
        awsAccessKey: "xxxxxxxxxxxxx",
        awsSecretAccessKey: "xxxxxxxxxxxxx",
        awsRegion: "xxxxxxxxxxxxx",
    },
}); // => P0_eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJwYXNza2V...


/* AZURE */

const token = await hsolve("https://captcha.website/", {
    solveService: {
        name: "azure",
        azureApiKey: "xxxxxxxxxxxxx",
        azureEndpoint: "xxxxxxxxxxxxx",
    },
}); // => P0_eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJwYXNza2V...


/* CUSTOM */

const token = await hsolve("https://captcha.website/", {
    solveService: {
        name: "custom",
        customUrl: "https://custom-api.com/",
    },
}); // => P0_eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJwYXNza2V....

```
For custom solving solution code makes a GET request to the API url with imageurl parameter and expects a json response.
Example json response from your api:

```json
{ success: true, message: [{ className: "bicycle" }] }
```

## Maintainer

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/0ef0263db65e44b5886beed7e8aa0381)](https://app.codacy.com/manual/zedd3v/hsolve?utm_source=github.com&utm_medium=referral&utm_content=zedd3v/hsolve&utm_campaign=Badge_Grade_Dashboard)
[![ZedDev](https://github.com/zedd3v.png?size=100)](https://abck.dev/)

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)

Heavily inspired by https://github.com/JimmyLaurent/hcaptcha-solver