const fault=code=>Object.assign(new Error(code),{code});
export const USER_INPUT_OFFICIAL='official';
export const USER_INPUT_PLUGIN='plugin';

/** Two-axis routing for one ZCode `userInput` interaction.
 *
 * The official `ctx.userQuestions.ask()` path is only offered the generic, mappable, untimed
 * variant. It cannot honour `sensitive` (masked / no draft), cannot disable its unconditional
 * free-text row, and its engage/countdown is client-local with no RPC — so a timed request would
 * expire in the composer while ZCode's own timer runs independently. Those variants go to the
 * plugin questionnaire card instead. */
export function classifyUserInputRoute(interaction){
  if(interaction?.kind!=='userInput')throw fault('interaction-mapping-unavailable');
  const payload=interaction.payload??{};
  if(payload.sensitive===true)return USER_INPUT_PLUGIN;
  if(payload.freeText===false)return USER_INPUT_PLUGIN;
  if(interaction.autoResolution!=null)return USER_INPUT_PLUGIN;
  return USER_INPUT_OFFICIAL;
}
export const userInputQuestions=interaction=>interaction?.payload?.questions??[];
/** True when the request is a multi-question questionnaire rather than the legacy flat prompt. */
export const isQuestionnaire=interaction=>userInputQuestions(interaction).length>0;

/** Map a ZCode userInput request onto the official `AskUserQuestionItem[]` shape. Question ids are
 * positional (`q<index>`) so the official answer can be mapped back without inventing identity. */
export function officialRequestQuestions(interaction){
  const questions=userInputQuestions(interaction);
  if(questions.length)return questions.map((question,index)=>({
    id:`q${index}`,
    question:String(question.question??''),
    ...(question.header!==undefined?{header:String(question.header)}:{}),
    ...(Array.isArray(question.options)&&question.options.length?{options:question.options.map(option=>({label:String(option.label??''),...(option.description!==undefined?{description:String(option.description)}:{})}))}:{}),
    ...(question.multiSelect===true?{multiSelect:true}:{}),
  }));
  const payload=interaction.payload??{};
  return [{
    id:'q0',
    question:String(payload.prompt??''),
    ...(Array.isArray(payload.options)&&payload.options.length?{options:payload.options.map(option=>({label:String(option.label??option.optionId??'')}))}:{}),
  }];
}

/** Wire semantics copied verbatim from the legacy questionnaire card: `answers` keyed by the
 * question text, plus `answer_<index>` and, for a single question, `answer`. */
export function buildElicitationContent(questions,drafts){
  const answers={};
  const content={answers};
  questions.forEach((question,index)=>{
    const draft=drafts?.[index]??{selectedValues:[],customAnswer:''};
    const custom=draft.customAnswer?draft.customAnswer.trim():'';
    const values=[...(draft.selectedValues??[]),...(custom?[custom]:[])];
    if(values.length>0){
      answers[question.question]=values.join(', ');
      content[`answer_${index}`]=question.multiSelect?values:values[0];
    }
  });
  if(questions.length===1){
    const draft=drafts?.[0]??{selectedValues:[],customAnswer:''};
    const custom=draft.customAnswer?draft.customAnswer.trim():'';
    const values=[...(draft.selectedValues??[]),...(custom?[custom]:[])];
    if(values.length>0)content.answer=questions[0].multiSelect?values:values[0];
  }
  return content;
}

/** Convert one official `AskUserQuestionAnswer` back into the legacy drafts shape. */
export function draftsFromOfficialAnswer(interaction,answer){
  const questions=userInputQuestions(interaction);
  const list=questions.length?questions:[{question:interaction?.payload?.prompt??''}];
  const items=new Map((answer?.answers??[]).map(item=>[item.id,item]));
  return list.map((_question,index)=>({selectedValues:[...(items.get(`q${index}`)?.selected??[])],customAnswer:items.get(`q${index}`)?.custom??''}));
}

/** ResolveInteraction answer body for an official-path completion. Questionnaires carry the
 * lossless multi-question `content`; the legacy flat prompt keeps the optionId/freeText path. */
export function officialAnswerPayload(interaction,answer){
  const questions=userInputQuestions(interaction);
  if(questions.length){
    const drafts=draftsFromOfficialAnswer(interaction,answer);
    return {content:buildElicitationContent(questions,drafts)};
  }
  const item=(answer?.answers??[])[0]??{selected:[],custom:undefined};
  const options=interaction?.payload?.options??[];
  const selectedLabel=item.selected?.[0];
  const option=options.find(candidate=>candidate.label===selectedLabel||candidate.optionId===selectedLabel);
  const custom=typeof item.custom==='string'&&item.custom.trim()?item.custom.trim():undefined;
  if(option)return {optionId:option.optionId,...(custom?{freeText:custom}:{})};
  if(custom)return {freeText:custom};
  return {freeText:selectedLabel??''};
}

/** Drafts for the plugin card's legacy flat prompt: a single answer item. */
export function flatDraftContent(interaction,draft){
  const payload=interaction?.payload??{};
  const options=payload.options??[];
  if(options.length){
    const option=options.find(candidate=>candidate.label===draft?.selectedValue);
    if(option)return {optionId:option.optionId};
  }
  const text=typeof draft?.freeText==='string'&&draft.freeText.trim()?draft.freeText.trim():undefined;
  return text?{freeText:text}:{};
}
