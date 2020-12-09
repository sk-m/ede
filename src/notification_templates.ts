import { registry_config } from "./registry";

// TODO make this prettier (make added rights blod-blue and removed bold-red)
export function usergroupmembershipupdate(
    executor_username: string,
    added_groups_string?: string,
    removed_groups_string?: string): string {
    return `${ executor_username } has changed your user group membership. Removed from ${ removed_groups_string || "<i>(none)</i>" }; added to ${ added_groups_string || "<i>(none)</i>" }.`;
}

export function accountcreated(): string {
    const instance_display_name = registry_config.get()["instance.display_name"].value as string;

    return `Welcome to ${ instance_display_name }!`;
}
