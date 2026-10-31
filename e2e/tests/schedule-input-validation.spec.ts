/** Schedule names and IDs that storage cannot hold are bad requests, not storage failures. */
import { expect, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { randomUUID } from "node:crypto";
import { Actors } from "../support/actors.ts";
import { Api, body } from "../support/api.ts";
import { appsManifest } from "../support/apps-release.ts";
import { HostedLive, withHostedCase } from "../support/case.ts";
import { scenarios } from "../test-plan.ts";

const source = `import { defineApp, mutation, userInterval, object, router } from "apps";
const work = mutation({ input: object({}) }, async () => ({ done: true }));
export default defineApp({}, async () => ({ tools: router({ work }), schedules: { review: userInterval({ minutes: 1 }, work, {}) } }));`;

/** A NUL cannot be stored; a tab and a line break are control characters no name or ID holds. */
const controls = ["%00", "a%00b", "%09", "%0A"];
const unknownCopy = "sch_00000000-0000-4000-8000-000000000000";
const unknownRun = "run_00000000-0000-4000-8000-000000000000";

layer(HostedLive, { excludeTestServices: true })("Schedule input validation", (it) => {
  it.effect(scenarios.scheduleInputValidation.title, (context) =>
    withHostedCase(
      context,
      Effect.gen(function* () {
        const api = yield* Api,
          actors = yield* Actors;
        const prefix = `/api/organizations/${actors.organization.id}`;
        const deployed = yield* api.request(actors.owner, "POST", `${prefix}/apps/deploy`, {
          name: `Schedule validation ${randomUUID().slice(0, 8)}`,
          files: [{ path: "index.ts", content: source }, appsManifest],
        });
        expect(deployed.status, JSON.stringify(deployed.body)).toBe(200);
        const app = yield* body(Schema.Struct({ id: Schema.String }), deployed);
        yield* Effect.addFinalizer(() =>
          api.request(actors.owner, "DELETE", `${prefix}/apps/${app.id}`).pipe(Effect.orDie),
        );
        const path = `${prefix}/apps/${app.id}/schedules`;
        const refused = (label: string, response: { status: number; body: unknown }) =>
          expect(response.status, `${label}: ${JSON.stringify(response.body)}`).toBe(400);

        for (const control of controls) {
          // The schedule's name, in the routes that take it.
          refused(
            `configure ${control}`,
            yield* api.request(actors.owner, "PATCH", `${path}/${control}`, { enabled: false }),
          );
          refused(
            `run ${control}`,
            yield* api.request(actors.owner, "POST", `${path}/${control}/run`),
          );
          // A copy's ID, under a schedule that exists.
          const copy = `${path}/review/copies/${control}`;
          refused(
            `update copy ${control}`,
            yield* api.request(actors.owner, "PATCH", copy, { enabled: false }),
          );
          refused(`run copy ${control}`, yield* api.request(actors.owner, "POST", `${copy}/run`));
          refused(`remove copy ${control}`, yield* api.request(actors.owner, "DELETE", copy));
          // A run's ID, where its approval is read and answered.
          const approval = `${prefix}/scheduled-runs/${control}/approval`;
          refused(`read approval ${control}`, yield* api.request(actors.owner, "GET", approval));
          refused(
            `answer approval ${control}`,
            yield* api.request(actors.owner, "POST", approval, { response: { action: "decline" } }),
          );
        }

        // Names and IDs without control characters keep their answers: an unknown one is not found,
        // an unknown run has nothing to review, and a declared schedule is configured.
        for (const response of [
          yield* api.request(actors.owner, "PATCH", `${path}/missing`, { enabled: false }),
          yield* api.request(actors.owner, "POST", `${path}/missing/run`),
          yield* api.request(actors.owner, "PATCH", `${path}/review/copies/${unknownCopy}`, {
            enabled: false,
          }),
        ])
          expect(response.body, JSON.stringify(response.body)).toMatchObject({
            _tag: "ScheduleNotFound",
          });
        expect(
          (yield* api.request(
            actors.owner,
            "GET",
            `${prefix}/scheduled-runs/${unknownRun}/approval`,
          )).body,
        ).toEqual({ status: "unavailable" });
        const configured = yield* api.request(actors.owner, "PATCH", `${path}/review`, {
          enabled: false,
        });
        expect(configured.status, JSON.stringify(configured.body)).toBe(200);
      }),
    ),
  );
});
