import { initSyntheticQaDatabase } from "./initSyntheticQaDb";
import { QA_DB_PATH, QA_ROOT } from "./qaPaths";

export default async function globalSetup() {
  const counts = initSyntheticQaDatabase();
  console.log(
    `[QA globalSetup] Initialized synthetic SQLite fixture at ${QA_DB_PATH} (QA_ROOT=${QA_ROOT}): ${JSON.stringify(counts)}`
  );
}
