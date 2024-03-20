/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { PluginOptions } from './index';
import { LoggerConfig } from '@genkit-ai/common';
import { LoggingWinston } from '@google-cloud/logging-winston';
import { LoggerOptions } from 'winston';

/**
 * Provides a {LoggerConfig} for exporting Genkit debug logs to GCP Cloud
 * logs.
 */
export class GcpLogger implements LoggerConfig {
  private readonly options: PluginOptions;

  constructor(options: PluginOptions) {
    this.options = options;
  }

  getConfig(): LoggerOptions {
    return {
      transports: [
        new LoggingWinston({
          projectId: this.options.projectId,
        }),
      ],
    };
  }
}