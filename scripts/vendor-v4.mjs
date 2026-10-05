// Read-only selective schema/pure-function transplant. No services or runtime imports.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root=resolve(process.argv[2]??'../reference/ZCode');
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(revision!=='29628c9acdb81b703bbd4080c207a0e7ce5e276e')throw Error('Unexpected reference revision');
const source=resolve(root,'packages/shared/src/zcode-protocol-v4');
const out='packages/host/vendor/zcode';
await mkdir(out,{recursive:true});
const exports={
 'command':['parseCommandEnvelope','commandAckSchema','commandsQueryResultSchema','COMMANDS_REQUIRING_BASE_REVISION','ROW_TARGETING_COMMANDS'],
 'transport':['v4ConversationPlansParamsSchema','v4ConversationPlansResultSchema','v4ConversationWorkflowRunEventsParamsSchema','v4ConversationWorkflowRunEventsResultSchema','v4ConversationWorkflowRunsParamsSchema','v4ConversationWorkflowRunsResultSchema','v4BackgroundBashOutputParamsSchema','conversationTopicFrameSchema','conversationTopicWireCandidateSchema','v4ConversationSubscribeParamsSchema','v4ConversationSubscribeResultSchema','v4ConversationResyncParamsSchema','v4ConversationResyncResultSchema','v4ConversationUnsubscribeParamsSchema','clientHelloSchema','helloMessageSchema','v4AttachmentPutParamsSchema','v4AttachmentPutResultSchema','v4AttachmentBeginParamsSchema','v4AttachmentBeginResultSchema','v4AttachmentChunkParamsSchema','v4AttachmentChunkResultSchema','v4AttachmentCommitParamsSchema','v4AttachmentCommitResultSchema','v4AttachmentAbortParamsSchema','v4AttachmentAbortResultSchema','v4AttachmentReadParamsSchema','v4AttachmentReadResultSchema','v4AttachmentPreviewSourceParamsSchema','v4AttachmentPreviewSourceResultSchema','v4ConversationAttachmentReadParamsSchema','v4ConversationAttachmentReadResultSchema','v4ConversationAttachmentStatParamsSchema','v4ConversationAttachmentStatResultSchema','v4ConversationFileChangesParamsSchema','v4ConversationFileChangesResultSchema','v4ConversationFileRewindPreviewParamsSchema','v4ConversationFileRewindPreviewResultSchema'],
 'attachment-ref':['attachmentRefSchema'],
 'shared-context-ref':['sharedContextRefSchema'],
 'shared-context-import':['sharedContextImportStateSchema'],
 'apply':['applyConversationDeltas'],
 'wire-assembler':['TopicWireFrameAssembler'],
 'wire-codec':['encodeTopicWireFrames','measureTopicNotificationEnvelopeBytes'],
 'wire-binary':['crc32WireBytes'],
 'core':['PROTOCOL_V4_LIMITS'],
 '../zcode-protocol/index':['zcodeWorkflowsListParamsSchema','zcodeWorkflowsListResultSchema','zcodeWorkflowsGetParamsSchema','zcodeWorkflowsGetResultSchema','zcodeWorkflowsUpdateMetaParamsSchema','zcodeWorkflowsUpdateMetaResultSchema','zcodeWorkflowsDeleteParamsSchema','zcodeWorkflowsDeleteResultSchema','zcodeWorkflowsMoveParamsSchema','zcodeWorkflowsMoveResultSchema','zcodeWorkflowsRunsParamsSchema','zcodeWorkflowsRunsResultSchema','zcodeBrowserListParamsSchema','zcodeBrowserListResultSchema','zcodeBrowserExecuteParamsSchema','zcodeBrowserExecuteResultSchema','zcodeComputerUseOperationEventSchema','zcodeSessionSubagentsParamsSchema','zcodeSessionSubagentsResultSchema','zcodeSessionCancelBackgroundTaskParamsSchema','zcodeSessionCancelBackgroundTaskResultSchema','zcodeWorkspaceUpdateInteractionPreferencesParamsSchema','zcodeWorkspaceUpdateInteractionPreferencesResultSchema','zcodeWorkspaceUpdateModelIoPreferencesParamsSchema','zcodeWorkspaceUpdateModelIoPreferencesResultSchema','zcodeWorkspaceReadPresentationParamsSchema','zcodeWorkspacePresentationSchema','zcodeMcpListParamsSchema','zcodeMcpListResultSchema','zcodePluginsListParamsSchema','zcodePluginsListResultSchema','zcodePluginInfoSchema','zcodePluginsReferenceCatalogParamsSchema','zcodePluginsReferenceCatalogResultSchema','zcodeSkillsReferenceCatalogParamsSchema','zcodeSkillsReferenceCatalogResultSchema','zcodePluginsOverviewParamsSchema','zcodePluginsOverviewResultSchema','zcodePluginsSetEnabledParamsSchema','zcodePluginsSetEnabledResultSchema','zcodePluginsMarketplaceAddParamsSchema','zcodePluginsMarketplaceRemoveParamsSchema','zcodePluginsMarketplaceUpdateParamsSchema','zcodePluginsMarketplaceMutationResultSchema','zcodePluginsInstallParamsSchema','zcodePluginsInstallResultSchema','zcodePluginsCancelOperationParamsSchema','zcodePluginsCancelOperationResultSchema','zcodePluginsUninstallParamsSchema','zcodePluginsUninstallResultSchema','zcodePluginsUpdateParamsSchema','zcodePluginsRestoreBuiltinParamsSchema','zcodePluginsRestoreBuiltinResultSchema','zcodePluginsConfigureParamsSchema','zcodePluginsConfigureResultSchema','zcodePluginsResetConfigParamsSchema','zcodePluginsValidateParamsSchema','zcodePluginsValidateResultSchema','zcodePluginsDescribeParamsSchema','zcodePluginsDescribeResultSchema','zcodePluginOperationProgressNotificationSchema','zcodePluginOperationStateSchema',
  'zcodePluginsResolveSuggestedReferenceParamsSchema','zcodePluginsResolveSuggestedReferenceResultSchema','zcodeProviderTestModelConnectivityParamsSchema','zcodeProviderTestModelConnectivityResultSchema',
  // S14 account/usage/diagnostics carriers (appended so earlier exports keep their order).
  'zcodeUsageStatsParamsSchema','zcodeUsageStatsResultSchema','zcodeTaskTokenUsageParamsSchema','zcodeTaskTokenUsageResultSchema','zcodeProcessChildProcessesParamsSchema','zcodeProcessChildProcessesResultSchema','zcodeProcessResourceSampleSchema',
  // S13 automation/off-peak protocol carriers (appended last so earlier exports keep their order).
  'zcodeAutomationScheduleRuleSchema','zcodeAutomationIntervalUnitSchema','zcodeAutomationProtocolSchema',
  'zcodeAutomationCreateParamsSchema','zcodeAutomationCreateResultSchema','zcodeAutomationUpdateParamsSchema','zcodeAutomationUpdateResultSchema',
  'zcodeAutomationListParamsSchema','zcodeAutomationListResultSchema',
  'zcodeAutomationCheckTaskBindingParamsSchema','zcodeAutomationCheckTaskBindingResultSchema',
  'zcodeAutomationDeleteParamsSchema','zcodeAutomationDeleteResultSchema',
  'zcodeOffPeakPermissionModeSchema','zcodeOffPeakCreateParamsSchema','zcodeOffPeakTaskSnapshotSchema','zcodeOffPeakCreateResultSchema',
  'zcodeOffPeakListParamsSchema','zcodeOffPeakListResultSchema'],
 // Appended last so adding this module does not renumber earlier bundled modules.
 '../background-bash-output':['backgroundBashOutputSchema','backgroundBashOutputResultSchema'],
 'workflow-artifacts':['v4ConversationWorkflowRunArtifactsParamsSchema','v4ConversationWorkflowRunArtifactsResultSchema','v4ConversationWorkflowRunArtifactDataParamsSchema','v4ConversationWorkflowRunArtifactDataResultSchema','v4ConversationWorkflowRunArtifactReadParamsSchema','v4ConversationWorkflowRunArtifactReadResultSchema'],
 'workflow-workspace':['v4ConversationWorkflowRunWorkspaceParamsSchema','v4ConversationWorkflowRunWorkspaceResultSchema','v4ConversationWorkflowRunNodeResultParamsSchema','v4ConversationWorkflowRunNodeResultResultSchema'],
 'create-workflow-display':['toolCallCreateWorkflowDisplaySchema'],
 'cuaPermission':['cuaPermissionObservationSchema'],
};
const notice='/*! Derived from ZCode @'+revision+'; Copyright 2026 Z.AI Co., Ltd. Apache-2.0 (LICENSE).\n * Modified: selective ESM bundle of shared schemas/pure functions, TypeScript erased; services excluded.\n * Regenerate with scripts/vendor-v4.mjs; see SOURCES.json for provenance. */';
const result=await build({stdin:{contents:Object.entries(exports).map(([file,names])=>`export {${names.join(',')}} from '${source}/${file}.ts';`).join('\n'),resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'neutral',treeShaking:true,external:['zod'],write:false,metafile:true,plugins:[{name:'read-only-shared',setup(b){b.onResolve({filter:/.*/},async args=>{
 if(args.path==='zod')return {path:'zod',external:true};
 let path=args.path.startsWith('.')?resolve(args.resolveDir,args.path):args.path;
 if(path.endsWith('.js'))path=path.slice(0,-3)+'.ts';
 if(path==='@zcode/model-option-map')path=resolve(root,'packages/model-option-map/src/index.ts');
 if(!path.startsWith(root+'/packages/shared/')&&!path.startsWith(root+'/packages/model-option-map/'))throw Error('Forbidden transplant dependency: '+path);
 await stat(path);return {path};
});}}],banner:{js:notice}});
const sources=[];for(const path of Object.keys(result.metafile.inputs)){if(path==='<stdin>')continue;const abs=resolve(path);sources.push({path:relative(root,abs),sha256:createHash('sha256').update(await readFile(abs)).digest('hex'),bytes:result.metafile.inputs[path].bytes});}
await writeFile(out+'/v4.mjs',result.outputFiles[0].contents);
await writeFile(out+'/SOURCES.json',JSON.stringify({repository:'https://github.com/zai-org/ZCode',revision,license:'Apache-2.0',exports,sources},null,2)+'\n');
await writeFile(out+'/LICENSE',await readFile(root+'/LICENSE'));
await writeFile(out+'/NOTICE.md',await readFile(root+'/NOTICE.md'));
console.log(JSON.stringify({sourceFiles:sources.length,outputBytes:result.outputFiles[0].contents.length}));
