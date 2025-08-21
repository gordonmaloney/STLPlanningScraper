
#  STL Planning Scraper

A Cypress script to scrape and process STL planning applications from Edinburgh Council's website

Note: This only works locally - it used to work through weekly GitHub actions but no longer does. For the future: let's explore putting in on a Lambda or something.

`npm run full` does the following:
1. Scrape the Edinburgh planning site (`scrape`)
2. Enrich the results with lat/lon and transform for the frontend  (`postprocess`)
3. Commit and push the updated data back to this repo



## Set up to run weekly

To set this script up to run weekly, do the following:

### On Mac:

We use **cron** (macOS’s built-in scheduler) to run the scraper automatically.

#### 1) Find your `npm` path
Open Terminal and run:
```bash
which npm
```
Common results:
- `/usr/local/bin/npm` (Intel Macs)
- `/opt/homebrew/bin/npm` (Apple Silicon)

Use the path returned on your machine in the cron entries below.

#### 2) Edit your crontab
Open your crontab editor:
```bash
crontab -e
```
*(If you prefer a friendlier editor than `vi`, run `VISUAL=nano crontab -e`.)*

#### 3) Add the jobs
Paste the two lines below, adjusting paths if needed:

```cron
# Every Monday at 09:00
0 9 * * 1 cd [...path]/stlplanningscraper && /usr/local/bin/npm run full >> [...path]/stlplanningscraper/cron.log 2>&1

# Also run on every reboot (catch up if the scheduled run was missed)
@reboot cd [...path]/stlplanningscraper && /usr/local/bin/npm run full >> [...path]/stlplanningscraper/cron.log 2>&1
```

> Replace `/usr/local/bin/npm` with whatever `which npm` returned, and update the repo path if your clone lives elsewhere.

#### 4) Save & verify
- In `vi`, press `Esc`, type `:wq`, then `Enter`.
- Confirm the jobs are installed:
```bash
crontab -l
```

#### 5) Logs & troubleshooting
- Logs are written to:
  ```
  [...path]/stlplanningscraper/cron.log
  ```
- Watch logs live:
  ```bash
  tail -f [...path]/stlplanningscraper/cron.log
  ```
- If you see `npm: command not found`, replace `/usr/local/bin/npm` with the output from `which npm`.
- If `git push` prompts for credentials, do one manual `git push` in Terminal to store them (Keychain helper).



### On Windows:
1) Open Task Scheduler → Create Basic Task…

2) Trigger: Weekly (pick your preferred day/time).

3) Action: Start a program

- Program/script: C:\Windows\System32\cmd.exe

- Add arguments:
```
/c cd /d "[...path]\stlplanningscraper" && "C:\Program Files\nodejs\npm.cmd" run full >> cron.log 2>&1
```

- (Adjust the paths to your repo and Node/NPM install.)

4) Finish → right-click the task → Run to test.