import { Domain } from "@prisma/client";
import { afterAll, describe, expect, test } from "vitest";
import { randomId } from "../utils/helpers";
import { IntegrationHarness } from "../utils/integration";

const slug = `${randomId()}.dub-internal-test.com`;

const domainRecord = {
  slug: slug,
  target: `https://${slug}/landing`,
  expiredUrl: `https://${slug}/expired`,
  placeholder: `https://${slug}/placeholder`,
  type: ["redirect", "rewrite"][Math.floor(Math.random() * 2)],
  noindex: true,
};

const expectedDomain = {
  id: expect.any(String),
  slug: domainRecord.slug,
  verified: expect.any(Boolean),
  primary: expect.any(Boolean),
  archived: false,
  noindex: domainRecord.noindex,
  placeholder: domainRecord.placeholder,
  expiredUrl: domainRecord.expiredUrl,
  target: domainRecord.target,
  type: domainRecord.type,
  clicks: 0,
};

describe.sequential("/domains/**", async () => {
  const h = new IntegrationHarness();
  const { workspace, http } = await h.init();

  afterAll(async () => {
    await h.deleteDomain(domainRecord.slug);
  });

  test("POST /domains", async () => {
    const { status, data: domain } = await http.post<Domain>({
      path: "/domains",
      query: { workspaceId: workspace.id },
      body: domainRecord,
    });

    expect(status).toEqual(201);
    expect(domain).toStrictEqual(expectedDomain);
  });

  test("GET /domains/{slug}/exists", async () => {
    // A domain exists (We just created it, so it should exist)
    const { status, data } = await http.get({
      path: `/domains/${domainRecord.slug}/exists`,
      query: { workspaceId: workspace.id },
    });

    expect(status).toEqual(200);
    expect(data).toEqual(1);

    // A domain does not exist
    const { status: status2, data: data2 } = await http.get({
      path: `/domains/random.com/exists`,
      query: { workspaceId: workspace.id },
    });

    expect(status2).toEqual(200);
    expect(data2).toEqual(0);
  });

  test("GET /domains/{slug}", async () => {
    const { status, data: domain } = await http.get<Domain>({
      path: `/domains/${domainRecord.slug}`,
      query: { workspaceId: workspace.id },
    });

    expect(status).toEqual(200);
    expect(domain).toStrictEqual({
      ...expectedDomain,
      url: domainRecord.target,
    });
  });

  test("GET /domains", async () => {
    const { status, data: domains } = await http.get<Domain[]>({
      path: "/domains",
      query: { workspaceId: workspace.id },
    });

    expect(status).toEqual(200);
    expect(domains).toContainEqual(expectedDomain);
  });

  test("POST /domains/{slug}/primary", { retry: 3 }, async () => {
    const { status, data: domain } = await http.post<Domain>({
      path: `/domains/${domainRecord.slug}/primary`,
      query: { workspaceId: workspace.id },
    });

    expect(status).toEqual(200);
    expect(domain).toStrictEqual({
      ...expectedDomain,
      primary: true,
    });
  });

  test("PATCH /domains/{slug}", { retry: 3 }, async () => {
    const toUpdate = {
      target: `https://${slug}/landing-new`,
      expiredUrl: `https://${slug}/expired-new`,
      placeholder: `https://${slug}/placeholder-new`,
      type: "rewrite",
      noindex: false,
      archived: true,
    };

    const { status, data: domain } = await http.patch<Domain>({
      path: `/domains/${domainRecord.slug}`,
      query: { workspaceId: workspace.id },
      body: toUpdate,
    });

    expect(status).toEqual(200);
    expect(domain).toStrictEqual({
      ...expectedDomain,
      ...toUpdate,
      primary: true,
    });
  });
});
