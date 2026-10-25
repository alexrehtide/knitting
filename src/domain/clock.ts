/** Source of the current time; a fixed adapter in tests. */
export interface Clock {
  now(): Date
}
