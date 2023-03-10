import * as core from '@actions/core';
import * as github from '@actions/github';
import type {} from '@actions/github/lib/interfaces';
import { determineAssigneesForPrAndThrowIfNoCreator } from './determineAssigneesForPrAndThrowIfNoCreator';
import { determineTriggeringEventType } from './determineTriggeringEventType';
import { extractSharedContextDetails } from './extractSharedContextDetails';
import { getCreatorAssigneeSubstitutionsAndThrowIfInvalid } from './getCreatorAssigneeSubstitutionsAndThrowIfInvalid';
import { getTokenFromCoreOrThrow } from './getTokenFromCoreOrThrow';

export async function main(): Promise<void> {
    try {
        const event = determineTriggeringEventType(github.context);
        console.info(
            `Determined triggering event type to be "${event}" (${github.context.eventName} / ${github.context.payload.action})`,
        );
        if (event === 'other') return;

        const token = getTokenFromCoreOrThrow(core);
        const creatorAssigneeSubstitutions = getCreatorAssigneeSubstitutionsAndThrowIfInvalid(core);
        const sharedContextDetails = extractSharedContextDetails(github.context);

        const octokit = github.getOctokit(token);
        const prResponse = await octokit.request(`GET /repos/{owner}/{repo}/pulls/{pull_number}`, {
            ...sharedContextDetails,
        });
        const assignees = determineAssigneesForPrAndThrowIfNoCreator({
            pr: prResponse.data,
            event,
            creatorAssigneeSubstitutions,
        });

        if (assignees.toAssign.length) {
            console.info(
                `Updating ${sharedContextDetails.owner}/${sharedContextDetails.repo} PR #${
                    sharedContextDetails.pull_number
                } to add the following assignees: ${assignees.toAssign.join(`, `)}`,
            );
            await octokit.rest.issues.addAssignees({
                ...sharedContextDetails,
                issue_number: sharedContextDetails.pull_number,
                assignees: assignees.toAssign,
            });
        }

        if (assignees.toUnassign.length) {
            console.info(
                `Updating ${sharedContextDetails.owner}/${sharedContextDetails.repo} PR #${
                    sharedContextDetails.pull_number
                } to remove the following assignees: ${assignees.toUnassign.join(`, `)}`,
            );
            await octokit.rest.issues.removeAssignees({
                ...sharedContextDetails,
                issue_number: sharedContextDetails.pull_number,
                assignees: assignees.toUnassign,
            });
        }
    } catch (error) {
        console.error(error);
        if (error instanceof Error) core.setFailed(error.message);
    }
}

void main();
