import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as SDK from "azure-devops-extension-sdk";
import {
  CommonServiceIds,
  getClient,
  IHostPageLayoutService,
} from "azure-devops-extension-api";
import { TaskAgentRestClient } from "azure-devops-extension-api/TaskAgent";
import { Build, BuildRestClient } from "azure-devops-extension-api/Build";

import { Header, TitleSize } from "azure-devops-ui/Header";
import { IHeaderCommandBarItem } from "azure-devops-ui/HeaderCommandBar";
import { Page } from "azure-devops-ui/Page";

import { showRootComponent } from "./Common";

const PROJECT_NAME = "IT";
const ENVIRONMENT_ID = 11;

const NORMAL_RELEASE_REGEX = /^v\d+\.0$/;
const VALID_RELEASE_REGEX = /^v\d+\.\d+$/;

interface IHubContentState {
  fullScreenMode: boolean;
  headerDescription?: string;
  useLargeTitle?: boolean;
  useCompactPivots?: boolean;
  data?: string;
}

enum ReleaseType {
  Normal = "Normal",
  Hotfix = "Hotfix",
}

const HubContent = (): JSX.Element => {
  const [state, setState] = useState<IHubContentState>({
    fullScreenMode: false,
  });

  const fetchReleasesForEnvironment = async () => {
    const runs = await getClient(
      TaskAgentRestClient
    ).getEnvironmentDeploymentExecutionRecords(PROJECT_NAME, ENVIRONMENT_ID);
    if (!runs) throw new Error("no build runs found");

    const buildIds = runs.map((r) => r.owner.id);
    const builds = await getClient(BuildRestClient).getBuilds(
      PROJECT_NAME,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      buildIds
    );

    const buildsByReleaseType: Record<ReleaseType, Build[]> = builds.reduce<
      Record<ReleaseType, Build[]>
    >(
      (dictionary, currentBuild) => {
        if (currentBuild.tags.length) {
          currentBuild.tags.map((t) => {
            const isValidVersionTag = VALID_RELEASE_REGEX.test(t);
            if (!isValidVersionTag) return;
            const isNormalRelease = NORMAL_RELEASE_REGEX.test(t);
            const releaseType: ReleaseType = isNormalRelease
              ? ReleaseType.Normal
              : ReleaseType.Hotfix;

            dictionary[releaseType] = [
              currentBuild,
              ...dictionary[releaseType],
            ];
          });
        }
        return dictionary;
      },
      {
        [ReleaseType.Normal]: [],
        [ReleaseType.Hotfix]: [],
      }
    );

    const numberOfReleasesPerType = Object.keys(buildsByReleaseType).map(
      (type) => `${type}: ${buildsByReleaseType[type as ReleaseType].length}`
    );
    console.log(numberOfReleasesPerType);

    setState((prev) => ({
      ...prev,
      data: JSON.stringify(numberOfReleasesPerType),
    }));
  };

  useEffect(() => {
    SDK.init();
    initializeFullScreenState();
    fetchReleasesForEnvironment();
  }, []);

  const commandBarItems = useMemo((): IHeaderCommandBarItem[] => {
    return [
      {
        id: "panel",
        text: "Panel",
        onActivate: () => {
          onPanelClick();
        },
        iconProps: {
          iconName: "Add",
        },
        isPrimary: true,
        tooltipProps: {
          text: "Open a panel with custom extension content",
        },
      },
      {
        id: "messageDialog",
        text: "arstarst",
        onActivate: () => {
          onMessagePromptClick();
        },
        tooltipProps: {
          text: "Open a simple message dialog",
        },
      },
      {
        id: "fullScreen",
        ariaLabel: state.fullScreenMode
          ? "Exit full screen mode"
          : "Enter full screen mode",
        iconProps: {
          iconName: state.fullScreenMode ? "BackToWindow" : "FullScreen",
        },
        onActivate: () => {
          onToggleFullScreenMode();
        },
      },
      {
        id: "customDialog",
        text: "Custom Dialog",
        onActivate: () => {
          onCustomPromptClick();
        },
        tooltipProps: {
          text: "Open a dialog with custom extension content",
        },
      },
    ];
  }, []);

  const onMessagePromptClick = async (): Promise<void> => {
    const dialogService = await SDK.getService<IHostPageLayoutService>(
      CommonServiceIds.HostPageLayoutService
    );
    dialogService.openMessageDialog("Use large title?", {
      showCancel: true,
      title: "Message dialog",
      onClose: (result) => {
        setState((prev) => ({ ...prev, useLargeTitle: result }));
      },
    });
  };

  const onCustomPromptClick = async (): Promise<void> => {
    const dialogService = await SDK.getService<IHostPageLayoutService>(
      CommonServiceIds.HostPageLayoutService
    );
    dialogService.openCustomDialog<boolean | undefined>(
      SDK.getExtensionContext().id + ".panel-content",
      {
        title: "Custom dialog",
        configuration: {
          message: "Use compact pivots?",
          initialValue: state.useCompactPivots,
        },
        onClose: (result) => {
          if (result !== undefined) {
            setState((prev) => ({ ...prev, useCompactPivots: result }));
          }
        },
      }
    );
  };

  const onPanelClick = async (): Promise<void> => {
    const panelService = await SDK.getService<IHostPageLayoutService>(
      CommonServiceIds.HostPageLayoutService
    );
    panelService.openPanel<boolean | undefined>(
      SDK.getExtensionContext().id + ".panel-content",
      {
        title: "My Panel",
        description: "Description of my panel",
        configuration: {
          message: "Show header description?",
          initialValue: !!state.headerDescription,
        },
        onClose: (result) => {
          if (result !== undefined) {
            setState((prev) => ({
              ...prev,
              headerDescription: result
                ? "This is a header description"
                : undefined,
            }));
          }
        },
      }
    );
  };

  const initializeFullScreenState = async () => {
    const layoutService = await SDK.getService<IHostPageLayoutService>(
      CommonServiceIds.HostPageLayoutService
    );
    const fullScreenMode = await layoutService.getFullScreenMode();
    if (fullScreenMode !== state.fullScreenMode) {
      setState((prev) => ({ ...prev, fullScreenMode }));
    }
  };

  const onToggleFullScreenMode = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, fullScreenMode: !prev.fullScreenMode }));
  }, []);

  useEffect(() => {
    const setFullScreenModeAsync = async () => {
      const layoutService = await SDK.getService<IHostPageLayoutService>(
        CommonServiceIds.HostPageLayoutService
      );
      layoutService.setFullScreenMode(state.fullScreenMode);
    };
    setFullScreenModeAsync();
  }, [state.fullScreenMode]);

  const { headerDescription, useLargeTitle } = state;

  return (
    <Page className="sample-hub flex-grow">
      <Header
        title="Sample Hub"
        commandBarItems={commandBarItems}
        description={headerDescription}
        titleSize={useLargeTitle ? TitleSize.Large : TitleSize.Medium}
      />
      {state.data ?? "no data"}
    </Page>
  );
};

showRootComponent(<HubContent />);
