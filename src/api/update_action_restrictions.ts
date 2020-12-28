import * as User from "../user";
import * as Log from "../log";
import { apiSendError, apiSendSuccess } from "../api";
import { GroupsAndRightsObject } from "../right";
import { Rejection, RejectionType } from "../utils";
import { getActionRestrictions, updateActionRestriction, updateGrantRight } from "../action_restrictions";
import { registry_action_restriction_object_types } from "../registry";
import he from "he";

export async function updateActionRestrictionsRoute(req: any, res: any, client_user?: User.User): Promise<void> {
    // Check if client is logged in
    if(!client_user) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Anonymous users can't perform this action"));
        return;
    }

    // Get the user-provided info
    const requested_object_type = req.body.object_type;
    const requested_target_object = req.body.target_object;

    // Check if client has the rights to update action restrictions
    let client_permissions_error = true;
    let client_object_type_disallowed = true;

    await User.getRights(client_user.id)
    .then((grouprights: GroupsAndRightsObject) => {
        if(grouprights.rights.manageactionrestrictions) {
            // Check the main right
            client_permissions_error = false;

            // Check if user is allowed to manage action restrictions of a requested object type
            if(grouprights.rights.manageactionrestrictions.allowed_object_types.includes(requested_object_type))
                client_object_type_disallowed = false;
        }
    })
    .catch(() => undefined);

    if(client_permissions_error) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "Only users with manageactionrestrictions right can update action restrictions"));
        return;
    }

    // Client is disallowed to manage action restrictions of object of requested type
    if(client_object_type_disallowed) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_ACCESS_DENIED, "You do not have permission to manage action restrictions of objects of requested type"));
        return;
    }

    // Get the information from the registry
    const registry_action_restriction_object_types_snapshot = registry_action_restriction_object_types.get();
    const object_type_info = registry_action_restriction_object_types_snapshot[requested_object_type];

    // Check if requested object type is valid (existent)
    if(!object_type_info) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, "Unknown object type"));
        return;
    }

    // Check the pattern for the object reference/id/name/etc.
    if(object_type_info.pattern && !requested_target_object.match(object_type_info.pattern)) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, "Invalid target_object parameter format"));
        return;
    }

    // Check the restrict_to parameter for correctness
    if(
        !req.body.restrict_to ||
        !req.body.restrict_to.match(/^[a-z_]{2,255}$/)
    ) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, "Invalid restrict_to argument format"));
        return;
    }

    // Check the restriction settings
    if(!req.body.restricted_actions || req.body.restricted_actions.length > 512) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, "restricted_actions parameter too long"));
        return;
    }

    try {
        JSON.parse(req.body.restricted_actions);
    } catch(e) {
        apiSendError(res, new Rejection(RejectionType.GENERAL_INVALID_DATA, "Invalid restricted_actions parameter format"));
        return;
    }

    // Check if there is already an action restriction in place for the requested object
    const old_action_restriction = await getActionRestrictions(requested_object_type, requested_target_object);

    // Create/update the action restrictions
    updateActionRestriction(requested_object_type, requested_target_object, req.body.restricted_actions, "grant_right", req.body.restrict_to, client_user.id)
    .then(() => {
        // Update/create the grant right
        if(old_action_restriction && old_action_restriction.restricted_to !== req.body.restrict_to) {
            // If the user changed the grant right needed to perform the action, update the new *and* the old one (decrement old one, increment new one)

            // Decrement old grant right
            updateGrantRight(old_action_restriction.restricted_to, "decrement");

            // Create/increment new one
            updateGrantRight(req.body.restrict_to, "increment");
        } else if(!old_action_restriction) {
            // No restrictions found for such object, which means that this grant right has to be incremented

            updateGrantRight(req.body.restrict_to, "increment");
        }

        // New log entry
        Log.createEntry("restrictwikipage", client_user.id, requested_target_object,
        `<a href="/User:${ client_user.username }">${ client_user.username }</a> Updated restriction settings for <code>${ requested_object_type } ${ requested_target_object }</code> to <code>grant_right:${ req.body.restrict_to }</code>. New restriction settings: <code>${ he.encode(req.body.restricted_actions) }</code>`, req.body.summary);

        apiSendSuccess(res);
    })
    .catch((rejection: Rejection) => {
        apiSendError(res, rejection);
    });
}
