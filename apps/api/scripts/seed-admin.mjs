import { env } from "../src/config/env.js";
import { query } from "../src/db/pool.js";
import { hashSecret } from "../src/lib/security.js";

const username = env.adminUsername;
const password = env.adminPassword;
const hash = await hashSecret(password);

await query(
  `
    insert into users (
      role,
      username,
      full_name,
      phone,
      pin_hash,
      must_change_password,
      active
    )
    values ('admin', $1, $2, null, $3, false, true)
    on conflict (username)
    do update
    set
      full_name = excluded.full_name,
      pin_hash = excluded.pin_hash,
      active = true
  `,
  [username.toLowerCase(), env.adminFullName, hash],
);

console.log(`Administrador inicial listo: ${username}`);
