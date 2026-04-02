# api-time-now-2026

## Deployment Instructions

### 1. Change `NODE_ENV` to `production` in `.env` file

```json
NODE_ENV=production
```

### 2. Deploy the project

```bash
npm run deploy
```

or

```bash
pnpm run deploy
```

### 3. Access the API

- After deployment, you can access the API at the following URL: <https://api-wra4rpnf3a-as.a.run.app/api>

### 4. Test the API

- You can test the API using `curl` or any API testing tool like Postman. For example, to test the cow say endpoint, you can run:

```bash
curl https://api-wra4rpnf3a-as.a.run.app/cow-say
```

- This should return a response with a cow saying "Hello from TimesNow API!".

```json
 __________________________
< Hello from TimesNow API! >
 --------------------------
        \   ^__^
         \  (oO)\_______
            (__)\       )\/\
             U  ||----w |
                ||     ||
```
