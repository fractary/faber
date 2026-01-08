console.error('1: Starting');
import { Command } from 'commander';
console.error('2: Imported commander');
import chalk from 'chalk';
console.error('3: Imported chalk');
import { createPlanCommand } from './dist/commands/plan/index.js';
console.error('4: Imported createPlanCommand');
console.error('All imports successful');
