import * as React from "react";
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
import { Tab, TabBar, TabSize } from "azure-devops-ui/Tabs";

import { showRootComponent } from "../../Common";

interface IHubContentState {
  selectedTabId: string;
  fullScreenMode: boolean;
  headerDescription?: string;
  useLargeTitle?: boolean;
  useCompactPivots?: boolean;
  data?: string;
}

class HubContent extends React.Component<{}, IHubContentState> {
  constructor(props: {}) {
    super(props);

    this.state = {
      selectedTabId: "overview",
      fullScreenMode: false,
    };
  }

  private async tryGetSomeData() {
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

    this.setState((prev) => ({ ...prev, data: JSON.stringify(tags) }));

    /// > job
    /// > build run
    /// > build run tag
  }

  public componentDidMount() {
    SDK.init();
    this.initializeFullScreenState();
    this.tryGetSomeData();
  }

  public render(): JSX.Element {
    const {
      selectedTabId,
      headerDescription,
      useCompactPivots,
      useLargeTitle,
    } = this.state;

    return (
      <Page className="sample-hub flex-grow">
        <Header
          title="Sample Hub"
          commandBarItems={this.getCommandBarItems()}
          description={headerDescription}
          titleSize={useLargeTitle ? TitleSize.Large : TitleSize.Medium}
        />
        <TabBar
          onSelectedTabChanged={this.onSelectedTabChanged}
          selectedTabId={selectedTabId}
          tabSize={useCompactPivots ? TabSize.Compact : TabSize.Tall}
        >
          <Tab name="Overview" id="overview" />
          <Tab name="Navigation" id="navigation" />
          <Tab name="Extension Data" id="extensionData" />
          <Tab name="Messages" id="messages" />
        </TabBar>
        {this.state.data ?? "no data"}
      </Page>
    );
  }

  private onSelectedTabChanged = (newTabId: string) => {
    this.setState({
      selectedTabId: newTabId,
    });
  };

  private getCommandBarItems(): IHeaderCommandBarItem[] {
    return [
      {
        id: "panel",
        text: "Panel",
        onActivate: () => {
          this.onPanelClick();
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
          this.onMessagePromptClick();
        },
        tooltipProps: {
          text: "Open a simple message dialog",
        },
      },
      {
        id: "fullScreen",
        ariaLabel: this.state.fullScreenMode
          ? "Exit full screen mode"
          : "Enter full screen mode",
        iconProps: {
          iconName: this.state.fullScreenMode ? "BackToWindow" : "FullScreen",
        },
        onActivate: () => {
          this.onToggleFullScreenMode();
        },
      },
      {
        id: "customDialog",
        text: "Custom Dialog",
        onActivate: () => {
          this.onCustomPromptClick();
        },
        tooltipProps: {
          text: "Open a dialog with custom extension content",
        },
      },
    ];
  }

  private async onMessagePromptClick(): Promise<void> {
    const dialogService = await SDK.getService<IHostPageLayoutService>(
      CommonServiceIds.HostPageLayoutService
    );
    dialogService.openMessageDialog("Use large title?", {
      showCancel: true,
      title: "Message dialog",
      onClose: (result) => {
        this.setState({ useLargeTitle: result });
      },
    });
  }

  private async onCustomPromptClick(): Promise<void> {
    const dialogService = await SDK.getService<IHostPageLayoutService>(
      CommonServiceIds.HostPageLayoutService
    );
    dialogService.openCustomDialog<boolean | undefined>(
      SDK.getExtensionContext().id + ".panel-content",
      {
        title: "Custom dialog",
        configuration: {
          message: "Use compact pivots?",
          initialValue: this.state.useCompactPivots,
        },
        onClose: (result) => {
          if (result !== undefined) {
            this.setState({ useCompactPivots: result });
          }
        },
      }
    );
  }

  private async onPanelClick(): Promise<void> {
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
          initialValue: !!this.state.headerDescription,
        },
        onClose: (result) => {
          if (result !== undefined) {
            this.setState({
              headerDescription: result
                ? "This is a header description"
                : undefined,
            });
          }
        },
      }
    );
  }

  private async initializeFullScreenState() {
    const layoutService = await SDK.getService<IHostPageLayoutService>(
      CommonServiceIds.HostPageLayoutService
    );
    const fullScreenMode = await layoutService.getFullScreenMode();
    if (fullScreenMode !== this.state.fullScreenMode) {
      this.setState({ fullScreenMode });
    }
  }

  private async onToggleFullScreenMode(): Promise<void> {
    const fullScreenMode = !this.state.fullScreenMode;
    this.setState({ fullScreenMode });

    const layoutService = await SDK.getService<IHostPageLayoutService>(
      CommonServiceIds.HostPageLayoutService
    );
    layoutService.setFullScreenMode(fullScreenMode);
  }
}

showRootComponent(<HubContent />);
