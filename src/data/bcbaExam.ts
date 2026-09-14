export type BCBAContentAreaId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

export type BCBAQuestion = {
  id: string;
  areaId: BCBAContentAreaId;
  area: string;
  concept: string;
  difficulty: 'Foundational' | 'Applied' | 'Advanced';
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  scored: boolean;
};

type Concept = {
  term: string;
  definition: string;
  example: string;
  teachingPoint: string;
};

type Area = {
  id: BCBAContentAreaId;
  name: string;
  scoredCount: number;
  concepts: Concept[];
};

export const BCBA_EXAM_SOURCE = {
  label: 'BACB BCBA Handbook — Examination Outline (6th ed.)',
  url: 'https://www.bacb.com/BCBA-Handbook',
  reviewed: '2026-09-14',
};

export const BCBA_EXAM_MINUTES = 240;
export const BCBA_EXAM_TOTAL_QUESTIONS = 185;
export const BCBA_EXAM_SCORED_QUESTIONS = 175;
export const BCBA_EXAM_UNSCORED_QUESTIONS = 10;

export const contentAreas: Area[] = [
  {
    id: 'A',
    name: 'Behaviorism and Philosophical Foundations',
    scoredCount: 8,
    concepts: [
      { term: 'Determinism', definition: 'The assumption that behavior is lawful and influenced by identifiable variables rather than occurring randomly.', example: 'A behavior analyst looks for environmental variables related to a recurring response instead of labeling it unpredictable.', teachingPoint: 'Determinism supports searching for functional relations rather than treating behavior as random.' },
      { term: 'Empiricism', definition: 'Objective observation and measurement of events rather than relying primarily on opinion or intuition.', example: 'A team measures response rate before deciding whether an intervention is working.', teachingPoint: 'Empiricism emphasizes observable, measurable evidence.' },
      { term: 'Parsimony', definition: 'Ruling out simpler, well-established explanations before adopting more complex explanations.', example: 'A supervisor checks whether unclear instructions explain errors before proposing a complicated motivational account.', teachingPoint: 'Parsimony favors the simplest adequate explanation consistent with the data.' },
      { term: 'Pragmatism', definition: 'Evaluating ideas by whether they help achieve useful prediction and influence over behavior.', example: 'A clinician favors a concept because it leads to effective, testable action for the client.', teachingPoint: 'Pragmatism asks whether an explanation is useful in producing effective action.' },
      { term: 'Selectionism', definition: 'Behavior is understood as being selected by consequences across biological, individual, and cultural levels.', example: 'A response becomes more likely across repeated contacts with reinforcement in a particular context.', teachingPoint: 'Selectionism focuses on how consequences shape repertoires over time.' },
      { term: 'Radical behaviorism', definition: 'A philosophy that treats private events as behavior subject to the same kinds of analysis as publicly observable behavior.', example: 'A behavior analyst acknowledges thinking as behavior without using it as an unobserved inner cause that ends the analysis.', teachingPoint: 'Radical behaviorism includes private events while maintaining a behavioral account.' },
      { term: 'Mentalism', definition: 'Explaining behavior by appealing to hypothetical inner entities in a way that stops further functional analysis.', example: 'Saying a learner refuses work because of a defiant inner trait without analyzing context or consequences.', teachingPoint: 'Mentalistic labels can obscure variables that are available for functional analysis.' },
      { term: 'Behavior as a subject matter in its own right', definition: 'Treating behavior itself as a natural phenomenon worthy of direct scientific study.', example: 'A researcher measures and analyzes responding rather than using behavior only as evidence for an inferred mental construct.', teachingPoint: 'Behavior analysis studies behavior directly and seeks orderly relations with environmental variables.' },
    ],
  },
  {
    id: 'B',
    name: 'Concepts and Principles',
    scoredCount: 24,
    concepts: [
      { term: 'Positive reinforcement', definition: 'A stimulus change follows a response and increases the future probability of that response.', example: 'After accurate data entry, a trainee receives specific praise and accurate data entry increases.', teachingPoint: 'Positive refers to adding a stimulus; reinforcement refers to an increase in future responding.' },
      { term: 'Negative reinforcement', definition: 'A stimulus is removed, reduced, or postponed following a response and the response increases.', example: 'Fastening a seat belt stops an aversive warning and seat-belt use becomes more likely.', teachingPoint: 'Negative reinforcement increases behavior through removal or avoidance of stimulation.' },
      { term: 'Positive punishment', definition: 'A stimulus is added after a response and the future probability of that response decreases.', example: 'A response produces an added corrective consequence and the response subsequently decreases.', teachingPoint: 'Punishment is defined by a decrease in future behavior, not by the intent of the procedure.' },
      { term: 'Negative punishment', definition: 'A stimulus is removed after a response and the future probability of that response decreases.', example: 'Access to a preferred activity is removed contingent on a response and that response decreases.', teachingPoint: 'Negative punishment removes a stimulus and decreases future responding.' },
      { term: 'Extinction', definition: 'A previously reinforced response no longer produces the maintaining reinforcer, resulting in decreased responding over time.', example: 'Attention-maintained calling out no longer produces attention and calling out gradually decreases.', teachingPoint: 'Extinction is defined by withholding the reinforcer that historically maintained the behavior.' },
      { term: 'Motivating operation', definition: 'An environmental event that momentarily changes the value of a consequence and changes behavior associated with that consequence.', example: 'Long periods without water increase the value of water and evoke responses that have produced water.', teachingPoint: 'MOs alter reinforcer effectiveness and the current frequency of relevant behavior.' },
      { term: 'Stimulus control', definition: 'A response occurs more often in the presence of a stimulus because reinforcement has been more available in that context.', example: 'A learner says “red” reliably when shown a red card after differential reinforcement for correct color naming.', teachingPoint: 'Stimulus control develops through differential reinforcement across stimulus conditions.' },
      { term: 'Stimulus generalization', definition: 'A learned response occurs in the presence of stimuli that share relevant properties with the training stimulus.', example: 'A learner greets unfamiliar teachers after being taught to greet several familiar teachers.', teachingPoint: 'Generalization is responding across stimuli or settings beyond the exact training conditions.' },
      { term: 'Response generalization', definition: 'Untrained responses that serve the same function occur after training one member of a response class.', example: 'After being taught to request help by saying “help please,” a learner later asks “can you help me?”', teachingPoint: 'Response generalization involves novel but functionally similar responses.' },
      { term: 'Shaping', definition: 'Differentially reinforcing successive approximations toward a terminal response.', example: 'A therapist reinforces progressively clearer vocal approximations of a target word.', teachingPoint: 'Shaping changes response form through successive approximations.' },
      { term: 'Chaining', definition: 'Teaching a sequence in which each response produces the cue for the next response and the completed chain contacts a terminal consequence.', example: 'A learner is taught the ordered steps of handwashing as a linked sequence.', teachingPoint: 'Chaining targets ordered response sequences rather than gradual changes in one response topography.' },
      { term: 'Respondent conditioning', definition: 'A previously neutral stimulus acquires eliciting functions through pairing with an unconditioned or already conditioned stimulus.', example: 'A tone comes to elicit salivation after repeated pairings with food.', teachingPoint: 'Respondent relations involve antecedent stimulus pairings and elicited responses.' },
      { term: 'Operant conditioning', definition: 'The process by which consequences alter the future probability of behavior.', example: 'Requests increase after they consistently produce access to preferred items.', teachingPoint: 'Operant behavior is selected by its consequences.' },
      { term: 'Fixed-ratio schedule', definition: 'Reinforcement is delivered after a fixed number of responses.', example: 'A token is delivered after every fifth completed math problem.', teachingPoint: 'FR schedules are response-based and require a constant number of responses.' },
      { term: 'Variable-ratio schedule', definition: 'Reinforcement follows a varying number of responses around an average.', example: 'A salesperson receives a sale after an unpredictable number of calls.', teachingPoint: 'VR schedules are response-based and often produce high, steady rates.' },
      { term: 'Fixed-interval schedule', definition: 'The first response after a fixed amount of time has elapsed is reinforced.', example: 'The first completed response after each 10-minute interval produces reinforcement.', teachingPoint: 'FI schedules are time-based with a constant interval.' },
      { term: 'Variable-interval schedule', definition: 'The first response after varying time intervals around an average is reinforced.', example: 'A supervisor checks work at unpredictable times averaging every 20 minutes and reinforces accurate performance when checked.', teachingPoint: 'VI schedules are time-based with changing intervals.' },
      { term: 'Discriminative stimulus', definition: 'A stimulus correlated with greater availability of reinforcement for a particular response.', example: 'An “OPEN” sign signals that entering the store can produce access to shopping.', teachingPoint: 'An SD signals the availability of a consequence given a response; it does not force the behavior.' },
      { term: 'S-delta', definition: 'A stimulus correlated with extinction or lower availability of reinforcement for a particular response.', example: 'A “CLOSED” sign signals that pulling the store door will not produce entry.', teachingPoint: 'An S-delta signals that reinforcement is unavailable or less available for the relevant response.' },
      { term: 'Rule-governed behavior', definition: 'Behavior primarily controlled by verbal descriptions of contingencies rather than direct contact with those contingencies.', example: 'A student follows laboratory safety steps after reading the posted rules before ever contacting the natural consequences.', teachingPoint: 'Rules can alter behavior before direct contingency contact.' },
      { term: 'Contingency-shaped behavior', definition: 'Behavior whose form or frequency develops primarily through direct contact with consequences.', example: 'A child adjusts how hard to push a door after repeated contact with the door’s resistance.', teachingPoint: 'Contingency-shaped behavior emerges through direct experience with consequences.' },
      { term: 'Automatic reinforcement', definition: 'Reinforcement occurs without the mediation of another person.', example: 'A sensory consequence produced directly by humming increases future humming.', teachingPoint: 'Automatic reinforcement does not require another person to deliver the consequence.' },
      { term: 'Establishing operation', definition: 'A motivating operation that increases the current value of a consequence and evokes behavior that has produced it.', example: 'Food deprivation increases the effectiveness of food as reinforcement and evokes food-seeking responses.', teachingPoint: 'An EO increases value and evokes relevant behavior.' },
      { term: 'Abolishing operation', definition: 'A motivating operation that decreases the current value of a consequence and abates behavior that has produced it.', example: 'Eating a large meal decreases the value of additional food and reduces food-seeking.', teachingPoint: 'An AO decreases value and abates relevant behavior.' },
    ],
  },
  {
    id: 'C',
    name: 'Measurement, Data Display, and Interpretation',
    scoredCount: 21,
    concepts: [
      { term: 'Frequency', definition: 'A count of how many times a response occurs.', example: 'A teacher records 14 hand raises during class.', teachingPoint: 'Frequency is a simple count; rate additionally incorporates observation time.' },
      { term: 'Rate', definition: 'Frequency expressed per unit of time.', example: 'A learner emits 12 responses in 6 minutes, reported as 2 responses per minute.', teachingPoint: 'Rate is useful when observation durations differ.' },
      { term: 'Duration', definition: 'The amount of time a response occurs from onset to offset.', example: 'A tantrum begins at 2:03 and ends at 2:11, for 8 minutes of duration.', teachingPoint: 'Duration captures how long a response lasts.' },
      { term: 'Latency', definition: 'The time between a relevant antecedent and the onset of a response.', example: 'Thirty seconds pass between an instruction and the learner beginning the task.', teachingPoint: 'Latency measures delay to response onset.' },
      { term: 'Interresponse time', definition: 'The elapsed time between two successive responses.', example: 'A practitioner measures seconds from one instance of stereotypy to the next.', teachingPoint: 'IRT measures spacing between responses.' },
      { term: 'Permanent product', definition: 'Measurement of a durable outcome produced by behavior after the behavior has occurred.', example: 'A supervisor counts completed, correctly filed records at the end of the shift.', teachingPoint: 'Permanent product is appropriate when behavior leaves a reliable, observable result.' },
      { term: 'Percentage', definition: 'A ratio of responses meeting a criterion to total opportunities, multiplied by 100.', example: 'A learner responds correctly on 8 of 10 trials, recorded as 80%.', teachingPoint: 'Percentages can conceal opportunity count, so always interpret the denominator.' },
      { term: 'Trials to criterion', definition: 'The number of response opportunities required to meet a defined performance standard.', example: 'A learner requires 17 teaching trials before independently meeting mastery criteria.', teachingPoint: 'Trials-to-criterion is useful for comparing acquisition efficiency.' },
      { term: 'Whole-interval recording', definition: 'An interval is scored only if the behavior occurs throughout the entire interval.', example: 'On-task behavior is marked only when it occurs for a full 30-second interval.', teachingPoint: 'Whole-interval recording tends to underestimate total occurrence.' },
      { term: 'Partial-interval recording', definition: 'An interval is scored if the behavior occurs at any point during the interval.', example: 'An interval is marked if aggression occurs even once during the 20-second interval.', teachingPoint: 'Partial-interval recording tends to overestimate total duration.' },
      { term: 'Momentary time sampling', definition: 'Behavior is recorded only at the instant an observation interval ends or at a specified moment.', example: 'A teacher records whether a student is on task exactly when each 2-minute timer sounds.', teachingPoint: 'Momentary time sampling samples behavior at discrete moments rather than continuously.' },
      { term: 'Total count IOA', definition: 'Smaller total count divided by larger total count, multiplied by 100.', example: 'Observers record 18 and 20 responses, producing 90% total count agreement.', teachingPoint: 'Total count IOA can mask disagreement about when individual responses occurred.' },
      { term: 'Exact count-per-interval IOA', definition: 'The percentage of intervals in which two observers recorded exactly the same count.', example: 'Observers compare their counts within each interval and score agreement only when the counts match exactly.', teachingPoint: 'Exact count-per-interval is a stringent count-based IOA measure.' },
      { term: 'Interval-by-interval IOA', definition: 'The percentage of intervals in which observers agree on occurrence versus nonoccurrence.', example: 'For each interval, both observers’ yes/no scores are compared.', teachingPoint: 'Interval-by-interval IOA evaluates agreement on occurrence status across intervals.' },
      { term: 'Scored-interval IOA', definition: 'Agreement is calculated only across intervals in which at least one observer recorded occurrence.', example: 'For low-rate behavior, intervals with at least one occurrence score are used as the denominator.', teachingPoint: 'Scored-interval IOA is often useful for low-frequency behavior.' },
      { term: 'Unscored-interval IOA', definition: 'Agreement is calculated only across intervals in which at least one observer recorded nonoccurrence.', example: 'For very high-rate behavior, intervals containing at least one nonoccurrence score are emphasized.', teachingPoint: 'Unscored-interval IOA can be useful when nonoccurrence is relatively rare.' },
      { term: 'Level', definition: 'The magnitude or value around which data points cluster within a condition.', example: 'Data in intervention consistently cluster near 3 responses per session compared with 12 in baseline.', teachingPoint: 'Level describes the vertical position of a data series.' },
      { term: 'Trend', definition: 'The overall direction of a data path over time.', example: 'Daily correct responses steadily increase across the intervention phase.', teachingPoint: 'Trend may be increasing, decreasing, or relatively flat.' },
      { term: 'Variability', definition: 'The degree to which repeated measures differ from one another.', example: 'Session values alternate widely between very low and very high numbers.', teachingPoint: 'High variability can make prediction and visual interpretation more difficult.' },
      { term: 'Cumulative record', definition: 'A display in which the response count accumulates so the data path never decreases.', example: 'Each response is added to the prior total, and slope reflects response rate.', teachingPoint: 'In a cumulative record, steeper slope means higher response rate.' },
      { term: 'Data path', definition: 'A series of plotted data points representing successive measurements of behavior.', example: 'Daily frequency values are plotted and connected across sessions within a condition.', teachingPoint: 'A data path helps analysts visually evaluate level, trend, and variability.' },
    ],
  },
  {
    id: 'D',
    name: 'Experimental Design',
    scoredCount: 13,
    concepts: [
      { term: 'Reversal design', definition: 'A design that demonstrates control by repeatedly introducing and withdrawing an independent variable when behavior is expected to reverse.', example: 'Baseline is followed by treatment, withdrawal, and reintroduction with corresponding behavior changes.', teachingPoint: 'Reversal designs can provide strong demonstrations when withdrawal is ethical and behavior is reversible.' },
      { term: 'Multiple-baseline design', definition: 'A design that introduces intervention at different times across behaviors, settings, or participants without withdrawing effective treatment.', example: 'Treatment begins for one classroom behavior while baseline continues for two others, then is staggered across them.', teachingPoint: 'Staggered intervention onset supports experimental control without reversal.' },
      { term: 'Alternating-treatments design', definition: 'Two or more conditions are rapidly alternated to compare their effects on behavior.', example: 'Two teaching procedures alternate across sessions using discriminative cues for each condition.', teachingPoint: 'Rapid alternation is useful for comparing relative effects efficiently.' },
      { term: 'Changing-criterion design', definition: 'Experimental control is shown when behavior tracks a sequence of systematically changed performance criteria.', example: 'Daily walking goals rise from 2,000 to 3,000 to 4,000 steps and behavior changes with each criterion.', teachingPoint: 'Behavior should change in step with successive criteria.' },
      { term: 'Prediction', definition: 'Using the current data pattern to anticipate what behavior would look like if conditions remained unchanged.', example: 'Stable baseline data are used to forecast continued responding without intervention.', teachingPoint: 'Prediction is one of the three elements of baseline logic.' },
      { term: 'Verification', definition: 'Demonstrating that the original prediction was accurate by showing behavior would have remained similar without the independent variable.', example: 'A return to baseline produces behavior consistent with the original baseline prediction.', teachingPoint: 'Verification tests the baseline prediction.' },
      { term: 'Replication', definition: 'Repeating an effect by reintroducing the independent variable or reproducing it across tiers.', example: 'Treatment is reintroduced and behavior again changes in the predicted direction.', teachingPoint: 'Replication strengthens confidence that the independent variable produced the effect.' },
      { term: 'Internal validity', definition: 'The extent to which observed behavior change can be attributed to the independent variable rather than uncontrolled variables.', example: 'A staggered design rules out coincidental events as a likely explanation for change.', teachingPoint: 'Internal validity concerns confidence in the causal relation within the study.' },
      { term: 'External validity', definition: 'The extent to which findings generalize across people, settings, behaviors, or other conditions.', example: 'An intervention effect is reproduced across several learners and environments.', teachingPoint: 'External validity concerns generality beyond the original demonstration.' },
      { term: 'Component analysis', definition: 'An analysis that identifies which components of a treatment package are necessary or active.', example: 'Elements of a multicomponent intervention are removed or added to determine which produce behavior change.', teachingPoint: 'Component analyses isolate active treatment elements.' },
      { term: 'Parametric analysis', definition: 'An analysis that systematically varies the value or intensity of one independent variable.', example: 'A practitioner compares 1-, 3-, and 5-minute reinforcement durations while holding other procedures constant.', teachingPoint: 'Parametric analyses evaluate how different values of an intervention variable affect behavior.' },
      { term: 'Confounding variable', definition: 'An uncontrolled variable that changes with the independent variable and offers an alternative explanation for behavior change.', example: 'A new therapist begins exactly when treatment starts, making therapist change inseparable from treatment change.', teachingPoint: 'Confounds weaken claims that the independent variable caused the effect.' },
      { term: 'Steady-state strategy', definition: 'Repeated measurement within conditions until a reasonably stable pattern permits meaningful prediction before changing conditions.', example: 'A researcher waits for baseline to stabilize before introducing treatment.', teachingPoint: 'Stable within-condition responding improves prediction and interpretation.' },
    ],
  },
  {
    id: 'E',
    name: 'Ethical and Professional Issues',
    scoredCount: 22,
    concepts: [
      { term: 'Scope of competence', definition: 'Providing services, teaching, or supervision only within areas for which one has appropriate education, training, and experience, or obtaining needed competence.', example: 'A BCBA refers a complex feeding case to a colleague with specialized expertise while seeking appropriate training.', teachingPoint: 'Competence requires recognizing limits and obtaining consultation, training, or referral when needed.' },
      { term: 'Informed consent', definition: 'Ensuring relevant parties understand material information, risks, benefits, and choices before agreeing to services when consent is required.', example: 'A practitioner explains a proposed assessment and alternatives in understandable language before obtaining authorization.', teachingPoint: 'Consent must be informed, voluntary, and appropriately documented.' },
      { term: 'Confidentiality', definition: 'Protecting private client and professional information and disclosing only as authorized or legally required.', example: 'A supervisor removes identifying details before discussing a teaching example and uses secure communication.', teachingPoint: 'De-identification and minimum-necessary disclosure help protect confidentiality.' },
      { term: 'Conflict of interest', definition: 'A situation in which personal, financial, or relational interests could interfere with professional judgment or client welfare.', example: 'A provider discloses and manages a financial relationship that could bias a referral recommendation.', teachingPoint: 'Conflicts should be identified, disclosed when appropriate, and managed to protect clients.' },
      { term: 'Multiple relationship', definition: 'Holding an additional relationship with a client, supervisee, or stakeholder that could risk impaired objectivity, exploitation, or harm.', example: 'A supervisor is asked to enter a business partnership with a current supervisee.', teachingPoint: 'Additional relationships require careful risk analysis and boundaries.' },
      { term: 'Accurate documentation', definition: 'Creating and maintaining truthful, timely, complete professional records that support continuity, accountability, and required reporting.', example: 'A trainee corrects an entry transparently rather than backdating or silently altering a signed record.', teachingPoint: 'Records should be accurate and changes should preserve integrity and auditability.' },
      { term: 'Data integrity', definition: 'Collecting, storing, analyzing, and reporting data honestly without fabrication, selective alteration, or misleading presentation.', example: 'A clinician reports all relevant sessions, including those that do not support the preferred hypothesis.', teachingPoint: 'Ethical data practices require accuracy and transparency.' },
      { term: 'Client dignity', definition: 'Respecting the worth, preferences, privacy, and autonomy of clients throughout behavior-analytic services.', example: 'A team selects a less intrusive teaching arrangement that preserves privacy while still meeting the treatment goal.', teachingPoint: 'Dignity should be considered in goals, procedures, communication, and environment.' },
      { term: 'Cultural responsiveness', definition: 'Actively considering relevant cultural and contextual variables and adjusting professional behavior without abandoning behavioral principles.', example: 'A BCBA asks a family about routines, values, communication preferences, and feasibility before finalizing goals.', teachingPoint: 'Responsive practice incorporates stakeholder context into assessment, collaboration, and intervention planning.' },
      { term: 'Professional boundaries', definition: 'Maintaining relationships and conduct that support objective, effective services and reduce risk of exploitation or role confusion.', example: 'A supervisor declines a relationship that would make evaluative feedback difficult to provide objectively.', teachingPoint: 'Boundaries protect both service quality and participants.' },
      { term: 'Least restrictive effective approach', definition: 'Selecting effective procedures that minimize unnecessary restriction, risk, or intrusion while meeting socially significant goals.', example: 'A team chooses an effective reinforcement-based procedure before considering more restrictive options.', teachingPoint: 'Risk, restrictiveness, effectiveness, and client welfare should all inform procedure selection.' },
    ],
  },
  {
    id: 'F',
    name: 'Behavior Assessment',
    scoredCount: 23,
    concepts: [
      { term: 'Operational definition', definition: 'An objective, observable, and measurable description that permits reliable identification of instances and noninstances.', example: '“Aggression” is defined by specific topographies such as open- or closed-hand contact with another person above a stated force criterion.', teachingPoint: 'Good definitions support consistent measurement across observers.' },
      { term: 'Indirect assessment', definition: 'Assessment based on reports from people rather than direct observation of the target behavior.', example: 'A caregiver completes an interview about when problem behavior usually occurs.', teachingPoint: 'Indirect methods are efficient but should generally be combined with direct data when feasible.' },
      { term: 'Descriptive assessment', definition: 'Direct observation of behavior and naturally occurring antecedents and consequences without experimental manipulation.', example: 'An observer records ABC sequences during typical classroom routines.', teachingPoint: 'Descriptive data identify correlations, not necessarily functional relations.' },
      { term: 'Functional analysis', definition: 'Systematic manipulation of antecedents and consequences to test hypotheses about behavioral function.', example: 'Test and control conditions are arranged to evaluate whether attention, escape, or other consequences maintain responding.', teachingPoint: 'Functional analysis can demonstrate a functional relation between behavior and environmental variables.' },
      { term: 'Preference assessment', definition: 'A systematic procedure used to identify stimuli or activities that may function as reinforcers.', example: 'Several items are presented in repeated choice arrays to identify relative preference.', teachingPoint: 'Preference does not guarantee reinforcement; reinforcer effects require demonstration on behavior.' },
      { term: 'Reinforcer assessment', definition: 'A procedure that directly tests whether a stimulus increases or maintains responding when delivered contingently.', example: 'Work responding is compared across conditions with and without contingent access to a candidate item.', teachingPoint: 'Reinforcer assessments demonstrate functional effects on behavior.' },
      { term: 'Skills assessment', definition: 'Systematic evaluation of an individual’s existing and emerging repertoires to guide instruction and goal selection.', example: 'A practitioner assesses communication, imitation, and daily-living skills before selecting targets.', teachingPoint: 'Skills assessment informs individualized, socially meaningful teaching priorities.' },
      { term: 'Ecological assessment', definition: 'Assessment of relevant environmental variables, routines, demands, supports, and contexts that may affect performance.', example: 'A BCBA evaluates classroom routines, staffing, materials, and transitions before designing support.', teachingPoint: 'Ecological assessment broadens analysis beyond the individual response.' },
      { term: 'Scatterplot', definition: 'A grid used to display occurrence or intensity of behavior across time blocks and days to detect temporal patterns.', example: 'A team marks episodes by half-hour blocks across two weeks and sees a consistent cluster before lunch.', teachingPoint: 'Scatterplots can reveal time-correlated patterns that guide further assessment.' },
      { term: 'Functional hypothesis', definition: 'A testable statement describing the variables likely to evoke and maintain a target behavior.', example: 'The team hypothesizes that task refusal is maintained by escape from difficult work.', teachingPoint: 'A useful hypothesis links measurable antecedent/consequence patterns to behavior and guides testing.' },
      { term: 'Record review', definition: 'Systematic examination of existing educational, medical, behavioral, or service records to inform assessment.', example: 'A clinician reviews prior plans, medication changes, and school data before direct observation.', teachingPoint: 'Record review provides context but does not replace current direct assessment when direct data are needed.' },
      { term: 'Social validity assessment', definition: 'Evaluation of the importance, acceptability, and perceived value of goals, procedures, and outcomes to relevant stakeholders.', example: 'Caregivers rate whether treatment goals and procedures fit family priorities and routines.', teachingPoint: 'Social validity helps ensure services are meaningful and acceptable.' },
    ],
  },
  {
    id: 'G',
    name: 'Behavior-Change Procedures',
    scoredCount: 25,
    concepts: [
      { term: 'Differential reinforcement of alternative behavior', definition: 'Reinforcing a desirable alternative response while placing the target response on extinction when appropriate.', example: 'Appropriate requests for breaks produce breaks while problem behavior no longer produces breaks.', teachingPoint: 'DRA strengthens a specific alternative response that can replace the target behavior.' },
      { term: 'Differential reinforcement of incompatible behavior', definition: 'Reinforcing a response that cannot physically occur at the same time as the target response.', example: 'Hands-in-pockets is reinforced as an incompatible response to hand hitting during a brief transition.', teachingPoint: 'DRI is a special form of DRA in which the replacement response is physically incompatible.' },
      { term: 'Differential reinforcement of other behavior', definition: 'Delivering reinforcement when the target behavior has not occurred for a specified interval or moment.', example: 'A learner receives reinforcement after 5 minutes with no aggression.', teachingPoint: 'DRO reinforces absence of the target response, not a specific alternative.' },
      { term: 'Differential reinforcement of low rates', definition: 'Reinforcing lower rates of a behavior when some amount of the behavior remains acceptable.', example: 'A student earns reinforcement when requests for reassurance stay below a criterion during class.', teachingPoint: 'DRL is appropriate when the goal is reduction rather than elimination.' },
      { term: 'Functional communication training', definition: 'Teaching a communicative response that accesses the same functional reinforcer maintaining problem behavior.', example: 'A learner is taught to request a break instead of engaging in escape-maintained aggression.', teachingPoint: 'FCT is most effective when the communication response efficiently contacts the relevant reinforcer.' },
      { term: 'Noncontingent reinforcement', definition: 'Delivering a maintaining or preferred stimulus on a time-based schedule independent of the target response.', example: 'Attention is provided on a fixed-time schedule rather than contingent on calling out.', teachingPoint: 'NCR can reduce motivation to engage in behavior that previously produced the same reinforcer.' },
      { term: 'Prompt fading', definition: 'Systematically reducing prompt assistance so control transfers to naturally relevant stimuli.', example: 'A full physical prompt is gradually reduced to partial physical, gestural, then independent responding.', teachingPoint: 'Fading prevents long-term dependence on artificial prompts.' },
      { term: 'Stimulus fading', definition: 'Gradually changing features of an antecedent stimulus to transfer control to the target stimulus.', example: 'A large color cue is gradually reduced until only the natural printed word controls responding.', teachingPoint: 'Stimulus fading changes the prompt stimulus itself over time.' },
      { term: 'Errorless teaching', definition: 'Arranging prompts and prompt timing to minimize learner errors while transferring stimulus control.', example: 'The correct response is immediately prompted on early trials and assistance is systematically faded.', teachingPoint: 'Errorless procedures aim to establish correct responding with few errors.' },
      { term: 'Token economy', definition: 'A conditioned reinforcement system in which tokens are earned for target behavior and later exchanged for backup reinforcers.', example: 'Completed work earns points that can be exchanged for selected activities.', teachingPoint: 'Tokens require a clear earning rule, exchange system, and effective backup reinforcers.' },
      { term: 'Behavioral momentum', definition: 'Using a sequence of high-probability requests before a lower-probability request to increase compliance with the latter.', example: 'A learner completes several easy requests before being presented with a difficult task.', teachingPoint: 'High-probability request sequences can increase the probability of compliance with a subsequent low-probability request.' },
      { term: 'Antecedent intervention', definition: 'Changing events before behavior to alter the probability of responding or improve stimulus control.', example: 'A visual schedule and choice of task order are provided before a difficult transition.', teachingPoint: 'Antecedent strategies alter context before the target response occurs.' },
      { term: 'Schedule thinning', definition: 'Gradually reducing the density or immediacy of reinforcement while maintaining treatment effects.', example: 'A break initially available after every appropriate request is gradually made available after longer periods of work.', teachingPoint: 'Thinning aims to make treatment practical while preserving behavior change.' },
      { term: 'Programming common stimuli', definition: 'Including stimuli from the generalization environment during training to promote transfer.', example: 'The same visual cues used in the community are incorporated into clinic teaching sessions.', teachingPoint: 'Common stimuli increase similarity between training and natural environments.' },
      { term: 'Multiple-exemplar training', definition: 'Teaching across varied examples, people, stimuli, or settings to promote generalization.', example: 'A learner practices identifying emotions using many faces, ages, and contexts.', teachingPoint: 'Varied exemplars reduce overly narrow stimulus control.' },
      { term: 'Maintenance', definition: 'Persistence of a learned behavior after teaching conditions or supports have been reduced or ended.', example: 'A skill remains accurate several weeks after intensive teaching is withdrawn.', teachingPoint: 'Maintenance asks whether behavior persists over time.' },
      { term: 'Generalization', definition: 'Behavior change extends beyond the exact teaching conditions to relevant stimuli, responses, people, or settings.', example: 'A communication skill taught at school occurs independently at home and in the community.', teachingPoint: 'Generalization should be planned and measured rather than assumed.' },
    ],
  },
  {
    id: 'H',
    name: 'Selecting and Implementing Interventions',
    scoredCount: 20,
    concepts: [
      { term: 'Function-based intervention', definition: 'An intervention selected because its components address variables shown or strongly supported to maintain the target behavior.', example: 'Escape-maintained behavior is treated by teaching an efficient break request and modifying task demands.', teachingPoint: 'Intervention selection should follow assessment findings and behavioral function when function is relevant.' },
      { term: 'Treatment integrity', definition: 'The extent to which an intervention is implemented as designed.', example: 'A checklist shows staff delivered reinforcement on 94% of planned opportunities.', teachingPoint: 'Low integrity can make an effective procedure appear ineffective and should be assessed before major treatment changes.' },
      { term: 'Social validity', definition: 'The social importance and acceptability of treatment goals, procedures, and outcomes.', example: 'A family reports that a goal is meaningful but a proposed procedure is too disruptive to daily routines.', teachingPoint: 'Effective intervention should also be meaningful and acceptable to relevant stakeholders.' },
      { term: 'Data-based decision making', definition: 'Using repeated measurement and predefined decision rules to continue, modify, or discontinue intervention.', example: 'A team changes the teaching procedure after data fail to improve across the agreed decision window.', teachingPoint: 'Clinical decisions should be anchored in data rather than impression alone.' },
      { term: 'Risk-benefit analysis', definition: 'Systematically weighing likely benefits, risks, burdens, and alternatives before selecting or continuing an intervention.', example: 'A team compares expected gains and potential adverse effects of several procedures before implementation.', teachingPoint: 'Risk-benefit analysis supports ethically defensible treatment choices.' },
      { term: 'Preference-informed intervention', definition: 'Incorporating client and stakeholder preferences into goals and procedures when clinically and ethically appropriate.', example: 'A learner chooses among effective reinforcers and preferred teaching materials.', teachingPoint: 'Choice and preference can improve acceptability and engagement.' },
      { term: 'Generalization programming', definition: 'Designing intervention from the outset to promote behavior change across relevant people, settings, stimuli, and responses.', example: 'Teaching is deliberately conducted with several instructors and in several settings.', teachingPoint: 'Generalization should be programmed rather than left to chance.' },
      { term: 'Maintenance programming', definition: 'Planning conditions that support durable behavior change after intensive intervention is reduced.', example: 'Reinforcement is thinned gradually and natural contingencies are recruited before formal treatment ends.', teachingPoint: 'Maintenance planning should begin before treatment is withdrawn.' },
      { term: 'Contextual fit', definition: 'The degree to which an intervention aligns with the routines, resources, skills, values, and constraints of the implementation environment.', example: 'A plan is simplified because the original schedule cannot be implemented reliably in the classroom routine.', teachingPoint: 'A technically sound intervention may fail if it does not fit the implementation context.' },
      { term: 'Least intrusive effective intervention', definition: 'Selecting a procedure that can reasonably achieve the goal while minimizing unnecessary restriction or burden.', example: 'The team begins with a reinforcement-based, skill-building procedure that has adequate support before considering more restrictive alternatives.', teachingPoint: 'Procedure selection should balance effectiveness, safety, dignity, and intrusiveness.' },
      { term: 'Procedural modification', definition: 'Changing intervention components systematically when data, integrity, side effects, or contextual variables indicate the current plan is inadequate.', example: 'After confirming high implementation integrity and flat data, the BCBA changes the reinforcement schedule according to a predefined rule.', teachingPoint: 'Modify treatment after analyzing data and implementation, not reflexively.' },
    ],
  },
  {
    id: 'I',
    name: 'Personnel Supervision and Management',
    scoredCount: 19,
    concepts: [
      { term: 'Behavior skills training', definition: 'A competency-based training package involving instructions, modeling, rehearsal, and feedback.', example: 'A supervisor explains a prompting procedure, demonstrates it, has the trainee practice, and gives performance feedback.', teachingPoint: 'BST requires active rehearsal and feedback, not lecture alone.' },
      { term: 'Performance feedback', definition: 'Information about performance that is specific, timely, and connected to observable behavior and expectations.', example: 'A supervisor describes exactly which treatment steps were implemented correctly and which need adjustment immediately after observation.', teachingPoint: 'Effective feedback is behavior-specific and actionable.' },
      { term: 'Task clarification', definition: 'Making performance expectations, steps, roles, and outcomes explicit.', example: 'A supervisor provides a concise checklist defining exactly how session notes should be completed.', teachingPoint: 'Unclear expectations can be an antecedent to poor staff performance.' },
      { term: 'Competency assessment', definition: 'Directly evaluating whether a trainee can perform a skill to a defined standard rather than assuming mastery from attendance or knowledge alone.', example: 'A supervisee must demonstrate the full assessment procedure accurately with a role-play client before independent use.', teachingPoint: 'Competency requires demonstrated performance.' },
      { term: 'Goal setting', definition: 'Defining observable, measurable performance targets and timelines for improvement.', example: 'A team sets a goal of 95% accurate data entry across five consecutive shifts.', teachingPoint: 'Specific measurable goals make performance expectations easier to monitor.' },
      { term: 'Performance monitoring', definition: 'Repeatedly measuring important staff or supervisee behavior over time to guide support and feedback.', example: 'A supervisor samples treatment-integrity data weekly and reviews trends with the technician.', teachingPoint: 'Supervision should include ongoing measurement, not only occasional impressions.' },
      { term: 'Reinforcement for staff performance', definition: 'Arranging valued consequences contingent on desired employee or supervisee performance.', example: 'Specific praise and preferred schedule choices follow consistent high-integrity implementation.', teachingPoint: 'Staff behavior, like client behavior, is sensitive to contingencies.' },
      { term: 'Systems support', definition: 'Changing organizational variables such as materials, workload, scheduling, workflow, or resources that affect performance.', example: 'A supervisor discovers that data sheets are unavailable during sessions and changes the supply process rather than only retraining staff.', teachingPoint: 'Performance problems may reflect system barriers rather than skill deficits.' },
      { term: 'Supervision contract', definition: 'A written agreement clarifying roles, responsibilities, expectations, evaluation processes, and other required supervision elements.', example: 'Before fieldwork begins, supervisor and trainee document expectations, responsibilities, feedback methods, and termination conditions.', teachingPoint: 'Clear agreements support accountable supervision relationships.' },
      { term: 'Active supervision', definition: 'Direct observation, ongoing contact, performance feedback, and responsive support rather than passive availability.', example: 'A supervisor observes implementation, reviews data, models a skill, and follows up on performance goals.', teachingPoint: 'High-quality supervision includes direct engagement with performance.' },
      { term: 'Delegation based on competence', definition: 'Assigning tasks only when the person has demonstrated the skills needed and the assignment is within appropriate roles.', example: 'A trainee conducts a procedure independently only after successful competency demonstration and under appropriate oversight.', teachingPoint: 'Delegation should match demonstrated competence and role boundaries.' },
    ],
  },
];

function seededShuffle<T>(items: T[], seed = 8675309): T[] {
  const copy = [...items];
  let state = seed >>> 0;
  const rand = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function rotate<T>(items: T[], offset: number): T[] {
  const n = items.length;
  if (!n) return [];
  const safe = ((offset % n) + n) % n;
  return [...items.slice(safe), ...items.slice(0, safe)];
}

function buildQuestion(area: Area, ordinal: number, scored: boolean): BCBAQuestion {
  const concepts = area.concepts;
  const target = concepts[ordinal % concepts.length];
  const distractors = rotate(concepts, ordinal + 1).filter((c) => c.term !== target.term).slice(0, 3);
  const pattern = ordinal % 4;
  const correctSlot = (ordinal * 3 + area.id.charCodeAt(0)) % 4;
  let prompt = '';
  let rawOptions: string[] = [];
  let explanation = target.teachingPoint;

  if (pattern === 0) {
    prompt = `Which concept BEST matches this description? ${target.definition}`;
    rawOptions = [target.term, ...distractors.map((d) => d.term)];
  } else if (pattern === 1) {
    prompt = `A behavior analyst encounters the following situation: ${target.example} Which concept is MOST directly illustrated?`;
    rawOptions = [target.term, ...distractors.map((d) => d.term)];
  } else if (pattern === 2) {
    prompt = `Which example BEST illustrates ${target.term}?`;
    rawOptions = [target.example, ...distractors.map((d) => d.example)];
    explanation = `${target.term}: ${target.teachingPoint}`;
  } else {
    prompt = `A supervisee asks for the most accurate explanation of ${target.term}. Which response should the supervisor give?`;
    rawOptions = [target.definition, ...distractors.map((d) => d.definition)];
  }

  const correct = rawOptions[0];
  const options = [...rawOptions];
  options.splice(0, 1);
  options.splice(correctSlot, 0, correct);

  return {
    id: `${scored ? 'S' : 'U'}-${area.id}-${String(ordinal + 1).padStart(3, '0')}`,
    areaId: area.id,
    area: `${area.id}. ${area.name}`,
    concept: target.term,
    difficulty: pattern === 0 ? 'Foundational' : pattern === 1 || pattern === 2 ? 'Applied' : 'Advanced',
    prompt,
    options,
    answer: correctSlot,
    explanation,
    scored,
  };
}

function buildScoredQuestions(): BCBAQuestion[] {
  return contentAreas.flatMap((area) =>
    Array.from({ length: area.scoredCount }, (_, index) => buildQuestion(area, index, true))
  );
}

function buildUnscoredQuestions(): BCBAQuestion[] {
  const order: BCBAContentAreaId[] = ['B', 'E', 'F', 'G', 'H', 'I', 'C', 'D', 'A', 'G'];
  return order.map((areaId, index) => {
    const area = contentAreas.find((candidate) => candidate.id === areaId)!;
    return buildQuestion(area, area.scoredCount + index + 3, false);
  });
}

export const fullBCBAExam: BCBAQuestion[] = seededShuffle(
  [...buildScoredQuestions(), ...buildUnscoredQuestions()],
  20260914
);

export function scoreExam(answers: Record<string, number>) {
  const scored = fullBCBAExam.filter((question) => question.scored);
  const correct = scored.filter((question) => answers[question.id] === question.answer).length;
  const byArea = contentAreas.map((area) => {
    const questions = scored.filter((question) => question.areaId === area.id);
    const areaCorrect = questions.filter((question) => answers[question.id] === question.answer).length;
    const missed = questions.filter((question) => answers[question.id] !== question.answer);
    const conceptCounts = new Map<string, number>();
    for (const question of missed) conceptCounts.set(question.concept, (conceptCounts.get(question.concept) || 0) + 1);
    return {
      areaId: area.id,
      area: area.name,
      correct: areaCorrect,
      total: questions.length,
      percent: questions.length ? Math.round((areaCorrect / questions.length) * 100) : 0,
      weakConcepts: [...conceptCounts.entries()].sort((a, b) => b[1] - a[1]).map(([concept]) => concept).slice(0, 6),
    };
  });
  return {
    correct,
    total: scored.length,
    percent: Math.round((correct / scored.length) * 100),
    answered: Object.keys(answers).length,
    byArea,
  };
}

export function buildWeakAreaPlan(answers: Record<string, number>, minutesPerDay = 45) {
  const result = scoreExam(answers);
  const weakest = [...result.byArea]
    .sort((a, b) => a.percent - b.percent || b.total - a.total)
    .slice(0, 3);
  const days = [
    { focus: weakest[0], mode: 'Concept repair', action: 'Relearn the core discriminations, then explain them back in your own words.' },
    { focus: weakest[0], mode: 'Applied examples', action: 'Work examples and non-examples until you can identify the controlling feature quickly.' },
    { focus: weakest[1] || weakest[0], mode: 'Scenario practice', action: 'Practice applied vignettes and write one sentence explaining why each distractor is wrong.' },
    { focus: weakest[2] || weakest[0], mode: 'Precision review', action: 'Build a compact comparison sheet for concepts you are still confusing.' },
    { focus: weakest[0], mode: 'Mixed retrieval', action: 'Complete a mixed set without notes, then immediately reteach every miss.' },
    { focus: weakest[1] || weakest[0], mode: 'Transfer', action: 'Generate novel examples from fieldwork, coursework, or everyday settings and classify them.' },
    { focus: weakest[0], mode: 'Mastery check', action: 'Take a targeted quiz and require at least 85% before reducing review frequency.' },
  ].map((day, index) => ({
    day: index + 1,
    title: `${day.mode}: ${day.focus.area}`,
    areaId: day.focus.areaId,
    area: day.focus.area,
    weakConcepts: day.focus.weakConcepts,
    minutes: minutesPerDay,
    action: day.action,
    blocks: [
      { label: 'Teach', minutes: Math.max(10, Math.round(minutesPerDay * 0.35)), instruction: `Review ${day.focus.weakConcepts.slice(0, 3).join(', ') || 'the lowest-performing concepts'} with definitions, examples, and non-examples.` },
      { label: 'Retrieve', minutes: Math.max(10, Math.round(minutesPerDay * 0.35)), instruction: 'Close the notes and answer from memory. Say why the correct answer is correct before checking.' },
      { label: 'Apply', minutes: Math.max(8, minutesPerDay - Math.max(10, Math.round(minutesPerDay * 0.35)) * 2), instruction: 'Solve novel applied scenarios and record the exact concept that caused any miss.' },
    ],
  }));

  return {
    generatedAt: new Date().toISOString(),
    examPercent: result.percent,
    weakest,
    minutesPerDay,
    masteryTarget: 85,
    days,
  };
}
