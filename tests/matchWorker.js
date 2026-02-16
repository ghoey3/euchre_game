import { parentPort, workerData } from "worker_threads";
import { playMatch } from "./playMatch.js";

const result = playMatch(workerData.tA, workerData.tB);

parentPort.postMessage(result);