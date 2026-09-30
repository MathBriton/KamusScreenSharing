import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { QUALITY_PRESETS, getPreset, type QualityId } from './quality';

interface Props {
  quality: QualityId;
  onQualityChange: (id: QualityId) => void;
  audio: boolean;
  onAudioChange: (enabled: boolean) => void;
  sharing: boolean;
}

export function ShareSettings({ quality, onQualityChange, audio, onAudioChange, sharing }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label="Qualidade da transmissão">
          <Settings2 />
          <span className="hidden sm:inline">{getPreset(quality).label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="grid gap-3">
          <div>
            <h4 className="font-medium">Qualidade</h4>
            <p className="text-sm text-muted-foreground">
              {sharing ? 'Aplicada na hora, sem reiniciar.' : 'Vale para o próximo compartilhamento.'}
            </p>
          </div>
          <RadioGroup value={quality} onValueChange={(v) => onQualityChange(v as QualityId)} className="gap-2">
            {QUALITY_PRESETS.map((p) => (
              <Label
                key={p.id}
                htmlFor={`q-${p.id}`}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 font-normal has-[[data-state=checked]]:border-primary"
              >
                <RadioGroupItem id={`q-${p.id}`} value={p.id} className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className="font-medium">{p.label}</span>
                  <span className="text-xs text-muted-foreground">{p.description}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
          <Separator />
          <div className="flex items-start justify-between gap-3">
            <Label htmlFor="share-audio" className="grid gap-0.5 font-normal">
              <span className="font-medium">Transmitir áudio</span>
              <span className="text-xs text-muted-foreground">
                {sharing
                  ? 'Vale para o próximo compartilhamento.'
                  : 'Desligado por padrão: com Discord aberto, as vozes sairiam em dobro.'}
              </span>
            </Label>
            <Switch id="share-audio" checked={audio} onCheckedChange={onAudioChange} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
