// Imports
import path from "path";

import mysql from "mysql2";
import fastify from "fastify";
import nodemailer from "nodemailer";
// tslint:disable-next-line: no-var-requires
const Redis = require("redis-fast-driver");

import fastify_static = require("fastify-static");
import fastify_cookie = require("fastify-cookie");
import fastify_formbody = require("fastify-formbody");

// Local imports
// TODO do something with this
import * as SECRETS from "../secrets.json";
import * as Util from "./utils";

import { registry_config, registry_skins, registry_namespaces, registry_hooks, registry_usergroups } from "./registry";
import { directRoute } from "./routes";
import * as Page from "./page";
import * as Extension from "./extension";
import * as Hook from "./hook";
import * as Api from "./api";
import * as IncidentLog from "./incident_log";
import { userNamespaceHandler } from "./userpage";
import { getEditorRoute } from "./editor";
import { userJoinRoute } from "./api/user/user_join";
import { userLoginRoute } from "./api/user/user_login";

// Fastify apps
const app: any = fastify();
const local_app: any = fastify();

// TODO add a handler for 404s

// Register fastify modules
app.register(fastify_cookie, {});

app.register(fastify_formbody, {
    addToBody: true
});

// Get server port
const server_port: number =
    process.env.EDE_DEV === "1" ? SECRETS["server.development_port"] : SECRETS["server.production_port"];

// Connect to the database
export const sql: any = mysql.createConnection({
    trace: false,
    multipleStatements: false,
    // debug: true,

    host: SECRETS["database.host"],
    port: SECRETS["database.port"],
    user: SECRETS["database.user"],
    password: SECRETS["database.pass"],
    database: SECRETS["database.dbname"]
});

/** @ignore Do not use this object! */
export let _mailer: any;
export let _mailer_ok = false;
export let _mailer_failed = false;

/** @ignore Do not use this object! */
export let _redis: any;
export let _redis_ok = false;
export let _redis_failed = false;

sql.connect(serverInit);

export function redisDisconnect(): void {
    if(!_redis_failed && _redis) _redis.end();
    _redis = null;
    _redis_ok = false;
    _redis_failed = false;

    Util.log("Disconnected from the Redis server");
}

export function redisConnect(): void {
    const registry_config_snapshot = registry_config.get();

    // If connection is already established - drop it
    if(_redis || _redis_ok) redisDisconnect();

    // Connect to the redis database
    const host = registry_config_snapshot["caching.host"].value as string;
    const port = registry_config_snapshot["caching.port"].value as number;

    _redis = new Redis({
        host,
        port,
        maxRetries: 0,
        // auth: "",
        autoConnect: true,
        doNotSetClientName: false,
        doNotRunQuitOnEnd: false
    });

    _redis.on("ready", () => {
        _redis_ok = true;

        Util.log("Successfully connected to the Redis server");
    });

    _redis.on("error", (error: Error) => {
        _redis_failed = true;

        Util.log(`Could not connect to the Redis server`, 3, error, { host, port });
    });
}

export function mailerDisconnect(): void {
    if(_mailer) _mailer.close();
    _mailer = null;
    _mailer_ok = false;
    _mailer_failed = false;

    Util.log("Disconnected from the mail server");
}

export function mailerConnect(): void {
    const registry_config_snapshot = registry_config.get();

    // If connection is already established - drop it
    if(_mailer || _mailer_ok) mailerDisconnect();

    const host = registry_config_snapshot["mail.host"].value as string;
    const port = registry_config_snapshot["mail.port"].value as number;
    const user = registry_config_snapshot["mail.user"].value as string;
    const pass = registry_config_snapshot["mail.pass"].value as string;
    const secure = registry_config_snapshot["mail.secure"].value as boolean;
    const reject_unauthorized = !(registry_config_snapshot["mail.ignore_invalid_certs"].value as boolean);

    _mailer = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: {
            rejectUnauthorized: reject_unauthorized
        }
    });

    _mailer.verify((error: any, success: boolean) => {
        if(error) {
            _mailer_failed = true;

            Util.log(`Mailer could not connect to the mail server`, 3, error, { host, port, user, secure, reject_unauthorized });
        } else {
            _mailer_ok = true;

            Util.log(`Mailer was successfully connected to the mail server`);
        }
    });
}

// Unhandled rejection handler for incident logging
process.on("unhandledRejection", (reason: any, promise: any) => {
    promise.catch((error: any) => {
        IncidentLog.createEntry(`Unhandled promise rejection: ${ reason.message }`, 3, error.stack || null, false);
    });
});

// ===== ServerInit (runs when the server starts) =====
/** @ignore */
async function serverInit(db_error: Error): Promise<void> {
    // Database error
    if(db_error) {
        Util.log(`Failed to connect to the database!`, 4, db_error);
        process.exit(1);
    }

    // Database logging
    if(process.env.EDE_DB_LOGGING === "1") {
        Util.log("Database logging enabled", 0);
        let i = 1;

        const old_query = sql.query;
        const old_execute = sql.execute;

        sql.query = (...args: any) => {
            const query_cmd = old_query.apply(sql, args);
            Util.log(`DB query #${ i }: ${ query_cmd.sql }`, 0);
            i++;

            return query_cmd;
        }

        sql.execute = (...args: any) => {
            const execute_cmd = old_execute.apply(sql, args);
            Util.log(`DB execute #${ i }: ${ execute_cmd.sql }`, 0);
            i++;

            return execute_cmd;
        }
    }

    // TODO We should check if the config is correct
    // Things to check: instance.domain

    // Get the database config
    await registry_config.update();

    // Get all groups
    await registry_usergroups.update();

    // Register all skins
    await registry_skins.update();

    // Get all namespaces
    const namespaces: Page.NamespacesObject = await registry_namespaces.updater_function();

    // Set a handler for a system, user and main namespaces (baked into ede)
    namespaces.System.handler = Page.systemNamespaceHandler;
    namespaces.User.handler = userNamespaceHandler;
    registry_namespaces.set(namespaces);

    // Load all extensions in the `./extensions` folder
    await Extension.loadAll().catch(() => undefined);

    // Register static routes
    app.register(fastify_static, {
        decorateReply: false,
        root: path.join(__dirname, "../skins"),
        prefix: '/public/skins',
    });

    app.register(fastify_static, {
        decorateReply: false,
        root: path.join(__dirname, "../lib"),
        prefix: '/public/lib',
    });

    app.register(fastify_static, {
        decorateReply: false,
        root: path.join(__dirname, "../static/assets"),
        prefix: '/public/assets',
    });

    // Register routes
    app.get("/*", directRoute);
    app.get("/api*", Api.RootRoute);
    app.get("/api/get_editor_html", getEditorRoute);

    app.post("/api*", Api.RootRoute);
    app.post("/api/auth/join", userJoinRoute);
    app.post("/api/auth/login", userLoginRoute);

    // Start the fastify server
    app.listen(server_port, "0.0.0.0", (fastify_error: Error, address: string) => {
        if(fastify_error) throw fastify_error;

        Util.log(`EDE main server listening on ${ address }`);
    });

    // Start the local server
    local_app.listen(5380, "127.0.0.1", (fastify_error: Error, address: string) => {
        if(fastify_error) throw fastify_error;

        Util.log(`EDE local management server listening on ${ address } (should not be accessible from outside)`);
    });

    const registry_config_snapshot = registry_config.get();

    // Set up the mailer
    if(registry_config_snapshot["mail.enabled"].value as boolean)
        mailerConnect();

    // Set up redis
    if(registry_config_snapshot["caching.enabled"].value as boolean)
        redisConnect();

    // Register ede hooks
    registry_hooks.set({
        ede_load: {
            name: "ede_load",

            description: "Called when EDE finished it's startup routine and is ready",
            source: "ede",

            call_args: {},
            response_args: {}
        },
        ede_page_requested: {
            name: "ede_page_requested",

            description: "Called when a page was just requested",
            source: "ede",

            call_args: {
                page_address: "PageAddress"
            },
            response_args: {
                continue: "bool"
            }
        }
    } as Hook.HooksObject);

    // Call the ede_onload hook
    await Hook.call("ede_load");
}
