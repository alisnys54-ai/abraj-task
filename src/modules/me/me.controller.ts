import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MeService } from './me.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AllowWhenPasswordChangeRequired } from '../../common/decorators/allow-when-password-change-required.decorator';

@ApiTags('Me')
@ApiBearerAuth('access-token')
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  // Allowed even mid-force-password-change — the frontend needs this to know
  // whose session it is and render the change-password screen with a name.
  @AllowWhenPasswordChangeRequired()
  @Get()
  getMe(@CurrentUser('userId') userId: string) {
    return this.meService.getProfile(userId);
  }

  @Patch()
  updateMe(@CurrentUser('userId') userId: string, @Body() dto: UpdateMeDto) {
    return this.meService.updateProfile(userId, dto);
  }
}
