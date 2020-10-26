// Imports
import path from "path";

import mysql from "mysql2";
import fastify from "fastify";

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
import { joinRoute, loginRoute } from "./user";
import * as Extension from "./extension";
import * as Hook from "./hook";
import * as Api from "./api";
import { userNamespaceHandler } from "./userpage";
import { getEditorRoute } from "./editor";

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
    multipleStatements: true,
    // debug: true,

    host: SECRETS["database.host"],
    port: SECRETS["database.port"],
    user: SECRETS["database.user"],
    password: SECRETS["database.pass"],
    database: SECRETS["database.dbname"]
});

sql.connect(serverInit);

// ===== ServerInit (runs when the server starts) =====
/** @ignore */
async function serverInit(db_error: Error): Promise<void> {
    // Database error
    if(db_error) {
        Util.log(`Failed to connect to the database!`, 4, db_error);
        process.exit(1);
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
    app.post("/api*", Api.RootRoute);
    app.post("/api/auth/join", joinRoute);
    app.post("/api/auth/login", loginRoute);
    app.get("/api/get_editor_html", getEditorRoute);

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
