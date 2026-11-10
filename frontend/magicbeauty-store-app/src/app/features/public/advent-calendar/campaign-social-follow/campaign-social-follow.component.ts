import { Component, input } from '@angular/core';

@Component({
  selector: 'app-campaign-social-follow',
  templateUrl: './campaign-social-follow.component.html',
  styleUrl: './campaign-social-follow.component.scss'
})
export class CampaignSocialFollowComponent {
  readonly instagramUrl = input.required<string>();
}
