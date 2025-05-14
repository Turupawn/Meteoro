# Slot Game Backend

## Running the Backend

### Prerequisites

- Node.js (v16+ recommended)
- npm
- [pm2](https://pm2.keymetrics.io/) process manager (`npm install -g pm2`)
- `.env` file with the following variables:
  - `RPC_URL` (your Ethereum node RPC endpoint)
  - `CONTRACT_ADDRESS` (deployed contract address)
  - `HOUSE_PRIVATE_KEY` (private key for the house wallet)
  - `PORT` (optional, default is 3000)

### Install dependencies

```bash
npm install
```

### Run with pm2

Start the backend with pm2:

```bash
pm2 start start.js --name slot-game-backend
```

To view logs:

```bash
pm2 logs slot-game-backend
```

To stop the backend:

```bash
pm2 stop slot-game-backend
```

To restart the backend:

```bash
pm2 restart slot-game-backend
```

To list all pm2 processes:

```bash
pm2 list
```

### Health Check

You can check if the backend is running by visiting:

```
http://localhost:3000/health
```

or (if you set a custom port):

http://localhost:<PORT>/health


---

**Note:**  
- Make sure your `.env` file is present and correctly configured before starting.
- The backend will print the house wallet address on startup. Use this address when deploying your contract.