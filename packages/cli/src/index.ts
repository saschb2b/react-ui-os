import process from "node:process";
import { run } from "./cli";

process.exit(run(process.argv.slice(2)));
