/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Rowe Wilson Frederisk Holme. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MWError, mWErrorTypeMapInline, mWErrorTypeMapOutline, MWWarnings, mWWarningsTypeMapInline, mWWarningsTypeMapOutline } from "./commonInterface";
import { a, u, o, m, r, uncast, cast, TypeMap } from "../convertFunction";
import { staticObjectConverter } from "../IObjectConverter";

/*
    ReadPageResult {
        error?: Error {
            code: string,
            info: string,
            *: string
        },
        warnings?: MWWarnings {
            main: WarnMain {
                *: string
            }
        }
        batchcomplete?: string,
        query?: Query {
            normalized?: Jump[] {
                from?: string,
                to?: string
            },
            redirects?: Jump[] {
                from?: string,
                to?: string
            },
            pages?: {
                [key: string]: Page {
                    pageid?: number,
                    ns?: number,
                    title?: string,
                    revisions?: Revision[] {
                        revid?: number,
                        parentid?: number,
                        slots?: Slots {
                            main?: Main {
                                main?: Main {
                                    contentmodel?: string,
                                    contentformat?: string,
                                    *?: string
                                }
                            }
                        }
                        // Old
                        contentformat?: string,
                        contentmodel?: string,
                        *?: string
                    },
                    missing?: string,
                    invalidreason?: string,
                    invalid?: string
                }
            },
            interwiki?: Interwiki[] {
                title?: string,
                iw?: string
            }
        }
    }
 */

export interface ReadPageResult {
    batchcomplete?: string;
    query?: Query;
    error?: MWError;
    warnings?: MWWarnings;
}

export interface Query {
    normalized?: Jump[];
    redirects?: Jump[];
    pages?: { [key: string]: Page };
    interwiki?: Interwiki[];
}

export interface Interwiki {
    title?: string;
    iw?: string;
}

export interface Jump {
    from?: string;
    to?: string;
}

export interface Page {
    pageid?: number;
    ns?: number;
    title?: string;
    revisions?: Revision[];
    missing?: string;
    invalidreason?: string;
    invalid?: string;
}

export interface Revision {
    revid?: number;
    parentid?: number;
    slots?: Slots;
    /**
     * Outdated
     *
     * slots.main.contentformat: string
     */
    contentformat?: string;
    /**
     * Outdated
     *
     * slots.main.contentmodel: string
     */
    contentmodel?: string;
    /**
     * Outdated
     *
     * slots.main.*: string
     */
    "*"?: string;
    diff?: Diff;
    moderation?: Moderation;
}

export interface Slots {
    main?: Main;
}

export interface Main {
    contentmodel?: string;
    contentformat?: string;
    "*"?: string;
}

export interface Diff {
    "*"?: string;
}

export interface Moderation {
    id?: number;
    statusCode?: number;
    userCanView?: string;
}

/** ReadPageResultConvert */
@staticObjectConverter<ReadPageConvert>()
export class ReadPageConvert {
    public static toResult(json: unknown): ReadPageResult {
        return cast(json, r("ReadPageResult"), readPageResultTypeMap);
    }

    public static resultToJson(value: ReadPageResult): unknown {
        return uncast(value, r("ReadPageResult"), readPageResultTypeMap);
    }
}

/* eslint-disable @typescript-eslint/naming-convention */
const readPageResultTypeMap: TypeMap = {
    "ReadPageResult": o([
        mWWarningsTypeMapInline,
        mWErrorTypeMapInline,
        { json: "batchcomplete", js: "batchcomplete", typ: u(undefined, "") },
        { json: "query", js: "query", typ: u(undefined, r("Query")) },
    ], false),
    ...mWWarningsTypeMapOutline,
    ...mWErrorTypeMapOutline,
    "Query": o([
        { json: "normalized", js: "normalized", typ: u(undefined, a(r("Jump"))) },
        { json: "redirects", js: "redirects", typ: u(undefined, a(r("Jump"))) },
        { json: "pages", js: "pages", typ: u(undefined, m(r("Page"))) },
        { json: "interwiki", js: "interwiki", typ: u(undefined, a(r("Interwiki"))) },
    ], false),
    "Interwiki": o([
        { json: "title", js: "title", typ: u(undefined, "") },
        { json: "iw", js: "iw", typ: u(undefined, "") },
    ], false),
    "Jump": o([
        { json: "from", js: "from", typ: u(undefined, "") },
        { json: "to", js: "to", typ: u(undefined, "") },
    ], false),
    "Page": o([
        { json: "pageid", js: "pageid", typ: u(undefined, 0) },
        { json: "ns", js: "ns", typ: u(undefined, 0) },
        { json: "title", js: "title", typ: u(undefined, "") },
        { json: "revisions", js: "revisions", typ: u(undefined, a(r("Revision"))) },
        { json: "missing", js: "missing", typ: u(undefined, "") },
        { json: "invalidreason", js: "invalidreason", typ: u(undefined, "") },
        { json: "invalid", js: "invalid", typ: u(undefined, "") },
    ], false),
    "Revision": o([
        { json: "revid", js: "revid", typ: u(undefined, 0) },
        { json: "parentid", js: "parentid", typ: u(undefined, 0) },
        { json: "slots", js: "slots", typ: u(undefined, r("Slots")) },
        // Outdated
        { json: "contentmodel", js: "contentmodel", typ: u(undefined, "") },
        { json: "contentformat", js: "contentformat", typ: u(undefined, "") },
        { json: "*", js: "*", typ: u(undefined, "") },
        { json: "diff", js: "diff", typ: u(undefined, r("Diff")) },
        { json: "moderation", js: "moderation", typ: u(undefined, r("Moderation")) },
    ], false),
    "Slots": o([
        { json: "main", js: "main", typ: u(undefined, r("Main")) },
    ], false),
    "Main": o([
        { json: "contentmodel", js: "contentmodel", typ: u(undefined, "") },
        { json: "contentformat", js: "contentformat", typ: u(undefined, "") },
        { json: "*", js: "*", typ: u(undefined, "") },
    ], false),
    "Diff": o([
        { json: "*", js: "*", typ: u(undefined, "") },
    ], false),
    "Moderation": o([
        { json: "id", js: "id", typ: u(undefined, 0) },
        { json: "status_code", js: "statusCode", typ: u(undefined, 0) },
        { json: "user_can_view", js: "userCanView", typ: u(undefined, "") },
    ], false),
};