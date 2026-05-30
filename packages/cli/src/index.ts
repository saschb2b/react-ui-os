import process from "node:process";
import { run } from "./cli";

run(process.argv.slice(2)).then((code) => {
  process.exit(code);
});
