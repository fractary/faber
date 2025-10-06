/**
 * Team concept loader
 */

import { z } from 'zod';
import { BaseConceptLoader } from './base';
import { Team, ConceptType, TeamMember, CoordinationType } from '../../types';
import * as yaml from 'js-yaml';
import { promises as fs } from 'fs';
import path from 'path';

const TeamMemberSchema = z.object({
  role: z.string(),
  name: z.string().optional(),
  config: z.record(z.unknown()).optional()
});

const TeamMetadataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  members: z.array(TeamMemberSchema),
  coordination: z.nativeEnum(CoordinationType).optional(),
  leader: z.string().optional(),
  workflows: z.array(z.string()).optional()
});

export class TeamLoader extends BaseConceptLoader<Team> {
  protected async loadConceptContent(conceptPath: string, metadata: any): Promise<Team> {
    const teamMetadata = TeamMetadataSchema.parse(metadata);

    return {
      name: teamMetadata.name,
      type: ConceptType.TEAM,
      description: teamMetadata.description,
      members: teamMetadata.members,
      coordination: teamMetadata.coordination,
      leader: teamMetadata.leader,
      workflows: teamMetadata.workflows || []
    };
  }

  protected async loadMetadata(conceptPath: string): Promise<any> {
    const metadataPath = path.join(conceptPath, 'team.yml');
    const content = await fs.readFile(metadataPath, 'utf-8');
    return yaml.load(content);
  }

  protected async validateConcept(team: Team): Promise<void> {
    // Validate team structure
    if (team.members.length === 0) {
      throw new Error('Team must have at least one member');
    }

    if (team.leader) {
      const leaderExists = team.members.some(m => m.name === team.leader);
      if (!leaderExists) {
        throw new Error(`Leader ${team.leader} not found in team members`);
      }
    }
  }

  getSchema() {
    return TeamMetadataSchema;
  }
}