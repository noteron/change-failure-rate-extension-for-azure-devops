import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as SDK from "azure-devops-extension-sdk";
import {
  CommonServiceIds,
  getClient,
  IHostPageLayoutService,
} from "azure-devops-extension-api";
import {
  EnvironmentInstance,
  TaskAgentRestClient,
} from "azure-devops-extension-api/TaskAgent";
import { Build, BuildRestClient } from "azure-devops-extension-api/Build";
import {
  TeamSettingsIteration,
  TimeFrame,
  WorkRestClient,
} from "azure-devops-extension-api/Work";

import { Header, TitleSize } from "azure-devops-ui/Header";
import { IHeaderCommandBarItem } from "azure-devops-ui/HeaderCommandBar";
import { Page } from "azure-devops-ui/Page";
import { Card } from "azure-devops-ui/Card";
import { MessageCard, MessageCardSeverity } from "azure-devops-ui/MessageCard";
import { Pill, PillSize } from "azure-devops-ui/Pill";

import { showRootComponent } from "./Common";

const PROJECT_NAME = "IT";
const ENVIRONMENT_ID = 11;
const TEAM_NAME = "Web";

const NUMBER_OF_ITERATIONS = 5;

const NORMAL_RELEASE_REGEX = /^v\d+\.0$/;
const VALID_RELEASE_REGEX = /^v\d+\.\d+$/;

interface IHubContentState {
  fullScreenMode: boolean;
  headerDescription?: string;
  useCompactPivots?: boolean;
}

enum ReleaseType {
  Normal = "Normal",
  Hotfix = "Hotfix",
}

const HubContent = (): JSX.Element => {
  const [state, setState] = useState<IHubContentState>({
    fullScreenMode: false,
  });
  const [environment, setEnvironment] = useState<EnvironmentInstance>();
  const [iterations, setIterations] = useState<TeamSettingsIteration[]>([]);
  const [buildsByReleaseType, setBuildsByReleaseType] =
    useState<Record<ReleaseType, Build[]>>();
  const [changeFailureRate, setChangeFailureRate] = useState<number>();

  const fetchIterationsForTeam = async () => {
    const iterations = await getClient(WorkRestClient).getTeamIterations({
      project: PROJECT_NAME,
      team: TEAM_NAME,
      projectId: "",
      teamId: "",
    });
    const pastAndPresentIterations = iterations
      .filter(
        (iteration) => iteration.attributes.timeFrame !== TimeFrame.Future
      )
      .slice(-NUMBER_OF_ITERATIONS);
    setIterations(pastAndPresentIterations);
  };

  const fetchReleasesForEnvironment = async () => {
    const environment = await getClient(TaskAgentRestClient).getEnvironmentById(
      PROJECT_NAME,
      ENVIRONMENT_ID
    );
    if (!environment) throw new Error("no environment found");
    setEnvironment(environment);

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
    setBuildsByReleaseType(buildsByReleaseType);

    const numberOfReleasesPerType: Record<ReleaseType, number> = {
      [ReleaseType.Normal]: buildsByReleaseType[ReleaseType.Normal].length,
      [ReleaseType.Hotfix]: buildsByReleaseType[ReleaseType.Hotfix].length,
    };
    const changeFailureRate =
      (numberOfReleasesPerType[ReleaseType.Hotfix] /
        numberOfReleasesPerType[ReleaseType.Normal]) *
      100;
    setChangeFailureRate(changeFailureRate);
  };

  useEffect(() => {
    SDK.init();
    initializeFullScreenState();
    fetchIterationsForTeam();
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

  return (
    <Page className="sample-hub flex-grow">
      <Header
        title={environment?.name ?? ""}
        commandBarItems={commandBarItems}
        description={state.headerDescription}
        titleSize={TitleSize.Large}
        separator={true}
      />
      <div className="page-content">
        <MessageCard
          className="flex-self-stretch margin-bottom-16"
          severity={MessageCardSeverity.Info}
        >
          Change Failure Rate — The percentage of deployments causing a failure
          in production
        </MessageCard>
        <Card
          titleProps={{ text: "Change failure rate", ariaLevel: 3 }}
          className="margin-bottom-16"
        >
          <div>
            <div>{changeFailureRate}%</div>
            <div>
              During sprint X, how many of the releases lead to an incident?
              Alt. during sprint X (and X sprints in the past), how many
              incidents happened per release?
            </div>
          </div>
        </Card>
        <Card titleProps={{ text: "Last 5 iterations" }}>
          {iterations.map((iteration) => {
            if (!buildsByReleaseType) return undefined;

            const releases: Record<ReleaseType, number> = {
              [ReleaseType.Normal]: buildsByReleaseType[
                ReleaseType.Normal
              ].filter(
                (build) =>
                  build.startTime > iteration.attributes.startDate &&
                  build.startTime < iteration.attributes.finishDate
              ).length,
              [ReleaseType.Hotfix]: buildsByReleaseType[
                ReleaseType.Hotfix
              ].filter(
                (build) =>
                  build.startTime > iteration.attributes.startDate &&
                  build.startTime < iteration.attributes.finishDate
              ).length,
            };
            return (
              <div key={iteration.id} className="flex-grow">
                <div className="flex-row">
                  <div className="body-l">{iteration.name}</div>
                  {iteration.attributes.timeFrame === TimeFrame.Current && (
                    <Pill size={PillSize.compact} className="margin-left-8">
                      Current
                    </Pill>
                  )}
                </div>
                <div className="flex-row flex-wrap">
                  <div className="body-s">
                    {iteration.attributes.startDate.toLocaleDateString(
                      "en-US",
                      {
                        dateStyle: "medium",
                      }
                    )}
                    &nbsp;-&nbsp;
                  </div>
                  <div className="body-s">
                    {iteration.attributes.finishDate.toLocaleDateString(
                      "en-US",
                      {
                        dateStyle: "medium",
                      }
                    )}
                  </div>
                </div>
                <div className="flex-grow margin-top-8">
                  <div>Normal releases: {releases.Normal}</div>
                  <div>Hotfix releases: {releases.Hotfix}</div>
                  <div>Ratio: {releases.Hotfix / releases.Normal}</div>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </Page>
  );
};

showRootComponent(<HubContent />);
