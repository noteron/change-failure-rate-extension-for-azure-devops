import React, { useEffect, useMemo, useState } from "react";
import * as SDK from "azure-devops-extension-sdk";
import {
  CommonServiceIds,
  getClient,
  IHostPageLayoutService,
} from "azure-devops-extension-api";
import { TaskAgentRestClient } from "azure-devops-extension-api/TaskAgent";
import { BuildRestClient } from "azure-devops-extension-api/Build";

import { Header, TitleSize } from "azure-devops-ui/Header";
import { IHeaderCommandBarItem } from "azure-devops-ui/HeaderCommandBar";
import { Page } from "azure-devops-ui/Page";

import { showRootComponent } from "../../Common";

interface IHubContentState {
  selectedTabId: string;
  fullScreenMode: boolean;
  headerDescription?: string;
  useLargeTitle?: boolean;
  useCompactPivots?: boolean;
  data?: string;
}

const HubContent = (): JSX.Element => {
  const [state, setState] = useState<IHubContentState>({
    selectedTabId: "overview",
    fullScreenMode: false,
  });

  const tryGetSomeData = async () => {
    // TODO:
    // get
    /// environments
    const runs = await getClient(
      TaskAgentRestClient
    ).getEnvironmentDeploymentExecutionRecords("IT", 11);

    const buildId = runs?.[0].owner.id;
    if (!buildId) throw new Error("no build id");

    const build = await getClient(BuildRestClient).getBuild("IT", buildId);
    if (!build) throw new Error("cannot find build");

    const tags = build.tags;

    setState((prev) => ({ ...prev, data: JSON.stringify(tags) }));

    /// > job
    /// > build run
    /// > build run tag
  };

  useEffect(() => {
    SDK.init();
    initializeFullScreenState();
    tryGetSomeData();
  }, []);

  const onSelectedTabChanged = (newTabId: string) => {
    setState(prev => ({
      ...prev,
      selectedTabId: newTabId,
    }));
  };

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
        text: "Message",
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
        setState(prev => ({ ...prev, useLargeTitle: result }));
      },
    });
  }

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
            setState(prev => ({ ...prev, useCompactPivots: result }));
          }
        },
      }
    );
  }

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
            setState(prev => ({
              ...prev,
              headerDescription: result
                ? "This is a header description"
                : undefined,
            }));
          }
        },
      }
    );
  }

  const initializeFullScreenState = async () => {
    const layoutService = await SDK.getService<IHostPageLayoutService>(
      CommonServiceIds.HostPageLayoutService
    );
    const fullScreenMode = await layoutService.getFullScreenMode();
    if (fullScreenMode !== state.fullScreenMode) {
      setState(prev => ({ ...prev, fullScreenMode }));
    }
  }

  const onToggleFullScreenMode = async (): Promise<void> => {
    const fullScreenMode = !state.fullScreenMode;
    setState(prev => ({ ...prev, fullScreenMode }));

    const layoutService = await SDK.getService<IHostPageLayoutService>(
      CommonServiceIds.HostPageLayoutService
    );
    layoutService.setFullScreenMode(fullScreenMode);
  }

  const {
    headerDescription,
    useLargeTitle,
  } = state;

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
  }

showRootComponent(<HubContent />);
