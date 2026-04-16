---
title: Nest
description: Host on Hack Club's very own Nest!
order: 0
---

> **Warning:** Nest can be quite unreliable at times, and it may go down for extended periods of time. If you're hit by downtime, we'll work with you to make sure we can still review your project and get your payout. Check out the other guides for more options.

Let's get your API online with Hack Club's very own hosting platform, **Nest**! This is 100% free and can teach you a ton about how hosting works under the hood. It also supports custom domains, and all the other selfhosted options work as well here.

Before we start with Nest, you'll want to make sure you have an SSH client and a keypair generated. I use my terminal for this, but you can also use a variety of other dedicated SSH clients, like Termius (cross-platform). Quick shoutout here to [ShhShell](https://apps.apple.com/us/app/shhshell/id6746970159), an SSH client for iOS made by Nihaal, another Hack Clubber.

For now, I'll be using the terminal for this walkthrough, but feel free to use whatever you're comfortable with! If you haven't already, in your terminal, run `ssh-keygen`. It'll prompt you to enter a file to save the key, and you can just hit enter to use the default. Add a passphrase, or don't, it doesn't really matter. After this, you'll want to get the public key it just generated. Run `cat ~/.ssh/id_ed25519.pub` on Mac/Linux or `type $env:USERPROFILE\.ssh\id_ed25519.pub` on Windows (Powershell) to get the contents of your public key. It'll look something like the below:

```ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOrbeJygKoGcrBHx0MxeBKF2KcdB2PQd1HH36aVzTPWP demo@raspapi```

> **Note:** DO NOT EVER SHARE YOUR PRIVATE KEY. Only share your PUBLIC key (the one ending in `.pub`). The private key is effectively your password, so sharing it is the same as sharing your password.

Keep that handy for when you're asked for your public SSH key later on.

To get started, head over to [dashboard.hackclub.app](https://dashboard.hackclub.app). You'll get to pick a username, toss in your public key, and after you're done, wait for a bit. This username will be something you type a lot, and will also be the automatic subdomain you receive. For example, I can get anything.sahil.hackclub.app.

![here](https://cdn.hackclub.com/019d8936-5d03-7f1b-bc5e-041277216e9e/NESTY.png)

It can take up to a few days, so please be patient. Once you're in, you'll see a screen that looks something like the below.

![dash](https://cdn.hackclub.com/019d8938-d579-73ee-b439-7311d6a1c441/arewedeadasspng.png)

You will need to come back here after you've set up your API to run. To connect to your container, run the command shown there e.g. `ssh sahil@hackclub.app`, and you should be dropped in a terminal connected - it should say something like:

```root@sahil:~# ```

Run the following command to install necessary dependencies:

```bash
apt-get install git curl
```

Awesome sauce! Now let's get our app running. For the purposes of this guide, we'll be deploying a FastAPI Python app, but it should work for others as well. Do note that for other languages, your startup commands may be slightly different.

First, let's clone the repo. If your repository is public (as it should be for submission!) then it should be as simple as `git clone https://github.com/some/jellybeans`. Now, `cd` into that folder (e.g. ```cd jellybeans```) and run your startup command. For Python, using `uv` makes everything super simple. First, let's install `uv`.

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Now disconnect (ctrl-d) and reconnect to refresh the environment. To test, run `uv run main.py` and you should see:

```
INFO:     Started server process [1234]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

We've got to do a *bit* more work to get this publicly accessible, however. Let's exit this with ctrl-c. When we run this, we don't want it just to be running while we're connected - so let's use systemd to set it up as a service that will automatically restart itself and will start when we boot up the server. First, let's create a new service file (call it whatever you want)

```bash
nano /etc/systemd/system/jellybeans.service
```

```ini
[Unit]
Description=Jellybeans
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/jellybeans
ExecStart=/root/.local/bin/uv run main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then run:

```bash
systemctl daemon-reload
systemctl enable jellybeans
systemctl start jellybeans
```

You can check the status with `systemctl status jellybeans`. Now, it should be running - run `curl localhost:8000` to see if it's there. If it shows something like `curl: (7) Failed to connect to localhost port 8000: Connection refused`, it means something went wrong. Check the logs with `journalctl -u jellybeans` to see any potential errors. Once it's running, you can check the status of it with `systemctl status jellybeans`. If you need to make changes to the code, just edit it, and then run `systemctl restart jellybeans` to restart the service and see your changes.

Now, let's connect it to the internet. In the Nest dashboard, head to Domains, and put your desired subdomain. You can also put custom subdomains here (more info later). I'll put `jellybeans.sahil.hackclub.app`, and put the target port/address as my IP followed by the port my app is running on. It'll look something like `10.60.0.1:8000` as your destination. Click add, and after just a moment you should be able to visit your API at the subdomain you just set up! In this case, `jellybeans.sahil.hackclub.app`.

> **Note:** If your URL errors out, uvicorn may not be listening on the right interface. In your code, where it calls `uvicorn.run(app)`, change it to `uvicorn.run(app, host="0.0.0.0")` to make it listen on all interfaces.

And that's it! Your API is now live on the internet. Give yourself a round of applause. 

## Custom Domains
Do you have your own domain you want to connect? Let's set this up. In your DNS provider, set up a CNAME record for your desired domain (e.g. `jellybeans.dino.icu`) pointing to `username.hackclub.app`. Then, add a TXT record like so: `mycoolsite.com` -> `domain-verification=username`. Wait some time for the records to propagate, then add it in the same way you added the above subdomain in the Nest dashboard, but with your custom domain instead. After a moment, you should be able to access your API at your custom domain! If it doesn't work immediately, give it some time to propagate and try again.