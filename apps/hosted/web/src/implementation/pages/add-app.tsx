import { useMcpOrigin } from "../resource-origin.ts";
import { reportBrowserUsage } from "../../contracts/product-analytics.ts";
import { appManagement } from "../../contracts/app-management.ts";
import { useAtomMount } from "@effect/atom-react";
import { HostedFailure, useDashboardAtoms } from "../components/dashboard-bindings.tsx";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@executor-js/ui/components/button";
import { CatalogPage as Catalog, CatalogInstall } from "@executor-js/ui/dashboard/catalog";
import { InstallPublication } from "@executor-js/ui/dashboard/install-publication";
import { AppCreateForm } from "@executor-js/ui/dashboard/app-create";
import { type AppAcknowledgement } from "@executor-js/ui/contracts/app-management";
import type { CatalogEntry } from "@executor-js/catalog/contracts";
import type { Publication } from "@executor-js/sdk";
import type { App } from "@executor-js/sdk";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { useOrganizationRoute } from "../components/organization.tsx";
import { acknowledgeApp } from "../../contracts/apps.ts";

type Selection =
  | { readonly kind: "catalog"; readonly entry: CatalogEntry }
  | { readonly kind: "publication"; readonly publication: typeof Publication.Type }
  | { readonly kind: "blank" };

/** Public publications and integration templates share Add app and the same organization-owned app records. */
export function AddAppPage() {
  const mcpOrigin = useMcpOrigin();
  const atoms = useDashboardAtoms();
  useAtomMount(atoms.catalog);
  const { organization, slug: organizationSlug } = useOrganizationRoute();
  const navigate = useNavigate();
  const management = appManagement(organization);
  const [selection, setSelection] = useState<Selection>();
  const onApp: AppAcknowledgement = (get, app) => acknowledgeApp(get, organization, app);
  const installed = (app: App) =>
    navigate({
      to: "/org/$organizationSlug/apps/$appId",
      search: { view: Object.keys(app.requirements.accounts).length ? "accounts" : "overview" },
      params: { organizationSlug, appId: app.id },
    });
  const back = () => {
    reportBrowserUsage({ area: "apps", action: "install", outcome: "cancelled" });
    setSelection(undefined);
  };
  if (selection?.kind === "publication")
    return (
      <InstallPublication
        key={`${selection.publication.name}:${selection.publication.commit}`}
        Failure={HostedFailure}
        publication={selection.publication}
        atoms={management}
        onApp={onApp}
        onInstalled={installed}
        onBack={back}
      />
    );
  if (selection?.kind === "catalog")
    return (
      <CatalogInstall
        mutation={atoms.install}
        Failure={HostedFailure}
        key={selection.entry.id}
        entry={selection.entry}
        endpoint={`${mcpOrigin}/mcp`}
        onBack={back}
        onInstalled={installed}
      />
    );
  if (selection?.kind === "blank")
    return (
      <div className="page setup-page w-full shrink-0 [padding:24px_24px_48px] my-0 mx-auto max-w-212.5 max-[1000px]:[padding:20px_20px_40px] max-[740px]:[padding:18px_max(16px,_env(safe-area-inset-right))_max(32px,_env(safe-area-inset-bottom))_max(16px,_env(safe-area-inset-left))]">
        <Button
          variant="ghost"
          size="sm"
          className="back-link h-auto rounded-none p-0 font-normal hover:bg-transparent inline-flex gap-1.5 items-center text-[12px] text-muted-foreground mb-4.25 hover:text-foreground max-[740px]:min-h-11 max-[740px]:inline-flex max-[740px]:items-center max-[740px]:-mt-2 max-[740px]:mb-3"
          onClick={back}
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} aria-hidden size={14} />
          All apps
        </Button>
        <div className="page-heading gap-4 flex justify-between items-center min-h-12 mb-4.5 [&_p]:text-muted-foreground [&_p]:text-[13px] [&_p]:mt-1.25">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.035em] leading-[1.35]">
              Create blank app
            </h1>
            <p>Start from an empty app and build with your agent.</p>
          </div>
        </div>
        <AppCreateForm
          mutation={atoms.createBlank}
          Failure={HostedFailure}
          initialName=""
          input={(name) => ({ name })}
          onCreated={installed}
          onCancel={back}
          label="Create app"
        />
      </div>
    );
  return (
    <Catalog
      query={atoms.catalog}
      publications={management.catalog}
      PublicationFailure={HostedFailure}
      Failure={HostedFailure}
      onSelect={(entry) => {
        reportBrowserUsage({ area: "apps", action: "select_template", outcome: "started" });
        setSelection({ kind: "catalog", entry });
      }}
      onPublication={(publication) => {
        reportBrowserUsage({ area: "apps", action: "select_publication", outcome: "started" });
        setSelection({ kind: "publication", publication });
      }}
      back={
        <Link
          to="/org/$organizationSlug/apps"
          params={{ organizationSlug }}
          className="back-link inline-flex gap-1.5 items-center text-[12px] text-muted-foreground mb-4.25 hover:text-foreground max-[740px]:min-h-11 max-[740px]:inline-flex max-[740px]:items-center max-[740px]:-mt-2 max-[740px]:mb-3"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} size={14} />
          Apps
        </Link>
      }
      action={
        <div className="flex gap-2">
          <Button
            variant="outline"
            data-product-area="apps"
            data-product-action="blank_app"
            onClick={() => {
              reportBrowserUsage({ area: "apps", action: "blank_app", outcome: "started" });
              setSelection({ kind: "blank" });
            }}
          >
            Create blank app
          </Button>
          <Button variant="outline" asChild>
            <Link
              data-product-area="apps"
              data-product-action="custom_service"
              to="/org/$organizationSlug/apps/add/custom"
              params={{ organizationSlug }}
            >
              Connect a service
            </Link>
          </Button>
        </div>
      }
    />
  );
}
