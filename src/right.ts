export type GroupsObject = { [group_name: string]: Group };
export interface Group {
    name: string;

    added_rights: string[];
    right_arguments: { [right_name: string]: any };
}

export type RightsObject = { [right_name: string]: Right };
export interface Right {
    name: string;
    description: string;
    risk_text?: string;

    /** Name of the extension that provided the right */
    source: string;

    arguments: { [argument_name: string]: RightArgument };
}

export type RightArgumentType = "string" | "number" | "boolean" | "array" | "JSON";
export interface RightArgument {
    type: RightArgumentType[];
    description: string;

    default_value: any;
}

export interface GroupsAndRightsObject {
    groups: string[];
    rights: { [right_name: string]: any };
}
