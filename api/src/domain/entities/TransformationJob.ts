export interface TransformationJobProps {
  id: string;
  datasetId: string;
  userId: string;
  transformationType: TransformationType;
  status: JobStatus;
  priority: number;
  parameters: Record<string, unknown>;
  aiSuggestions: Record<string, unknown> | null;
  resultStorageKey: string | null;
  resultMetadata: Record<string, unknown> | null;
  errorMessage: string | null;
  errorDetails: Record<string, unknown> | null;
  retryCount: number;
  maxRetries: number;
  bullmqJobId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export type TransformationType =
  | 'CLEAN_NULLS'
  | 'NORMALIZE'
  | 'AGGREGATE'
  | 'FILTER'
  | 'MERGE'
  | 'CUSTOM';

export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export class TransformationJob {
  private constructor(private readonly props: TransformationJobProps) {}

  static create(
    props: Pick<
      TransformationJobProps,
      'id' | 'datasetId' | 'userId' | 'transformationType' | 'parameters'
    > &
      Partial<Pick<TransformationJobProps, 'priority' | 'maxRetries'>>
  ): TransformationJob {
    return new TransformationJob({
      ...props,
      status: 'QUEUED',
      priority: props.priority ?? 0,
      maxRetries: props.maxRetries ?? 3,
      aiSuggestions: null,
      resultStorageKey: null,
      resultMetadata: null,
      errorMessage: null,
      errorDetails: null,
      retryCount: 0,
      bullmqJobId: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
    });
  }

  static reconstitute(props: TransformationJobProps): TransformationJob {
    return new TransformationJob(props);
  }

  get id(): string {
    return this.props.id;
  }

  get datasetId(): string {
    return this.props.datasetId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get transformationType(): TransformationType {
    return this.props.transformationType;
  }

  get status(): JobStatus {
    return this.props.status;
  }

  get priority(): number {
    return this.props.priority;
  }

  get parameters(): Record<string, unknown> {
    return { ...this.props.parameters };
  }

  get aiSuggestions(): Record<string, unknown> | null {
    return this.props.aiSuggestions ? { ...this.props.aiSuggestions } : null;
  }

  get resultStorageKey(): string | null {
    return this.props.resultStorageKey;
  }

  get resultMetadata(): Record<string, unknown> | null {
    return this.props.resultMetadata ? { ...this.props.resultMetadata } : null;
  }

  get errorMessage(): string | null {
    return this.props.errorMessage;
  }

  get errorDetails(): Record<string, unknown> | null {
    return this.props.errorDetails ? { ...this.props.errorDetails } : null;
  }

  get retryCount(): number {
    return this.props.retryCount;
  }

  get maxRetries(): number {
    return this.props.maxRetries;
  }

  get bullmqJobId(): string | null {
    return this.props.bullmqJobId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get startedAt(): Date | null {
    return this.props.startedAt;
  }

  get completedAt(): Date | null {
    return this.props.completedAt;
  }

  canRetry(): boolean {
    return this.props.retryCount < this.props.maxRetries;
  }

  markProcessing(bullmqJobId: string): void {
    this.props.status = 'PROCESSING';
    this.props.bullmqJobId = bullmqJobId;
    this.props.startedAt = new Date();
  }

  markCompleted(resultStorageKey: string, resultMetadata: Record<string, unknown>): void {
    this.props.status = 'COMPLETED';
    this.props.resultStorageKey = resultStorageKey;
    this.props.resultMetadata = resultMetadata;
    this.props.completedAt = new Date();
  }

  markFailed(errorMessage: string, errorDetails?: Record<string, unknown>): void {
    this.props.status = 'FAILED';
    this.props.errorMessage = errorMessage;
    this.props.errorDetails = errorDetails ?? null;
    this.props.retryCount += 1;
    this.props.completedAt = new Date();
  }

  cancel(): void {
    this.props.status = 'CANCELLED';
    this.props.completedAt = new Date();
  }

  setAiSuggestions(suggestions: Record<string, unknown>): void {
    this.props.aiSuggestions = suggestions;
  }
}
